#![cfg_attr(target_arch = "wasm32", no_std)]

use core::ptr::{addr_of, addr_of_mut};

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo<'_>) -> ! {
    loop {}
}

pub const REPORT_LEN: usize = 91;
pub const MAX_DATA: usize = 80;

// The browser calls these exports on one thread. Copy each report out before
// the next request because the two fixed buffers are reused.
static mut REQUEST: [u8; REPORT_LEN] = [0; REPORT_LEN];
static mut RESPONSE: [u8; REPORT_LEN] = [0; REPORT_LEN];

#[no_mangle]
pub extern "C" fn request_ptr() -> *mut u8 {
    addr_of_mut!(REQUEST).cast::<u8>()
}

#[no_mangle]
pub extern "C" fn response_ptr() -> *mut u8 {
    addr_of_mut!(RESPONSE).cast::<u8>()
}

fn checksum(report: &[u8; REPORT_LEN]) -> u8 {
    report[3..89].iter().fold(0, |sum, byte| sum ^ byte)
}

fn prepare(report: &mut [u8; REPORT_LEN], class: u8, command: u8, tx: u8, data_len: usize) -> i32 {
    if data_len > MAX_DATA {
        return -1;
    }
    report.fill(0);
    report[2] = tx;
    report[6] = data_len as u8;
    report[7] = class;
    report[8] = command;
    0
}

#[no_mangle]
pub extern "C" fn prepare_request(class: u32, command: u32, tx: u32, data_len: u32) -> i32 {
    if class > 255 || command > 255 || tx > 255 {
        return -1;
    }
    unsafe { prepare(&mut *addr_of_mut!(REQUEST), class as u8, command as u8, tx as u8, data_len as usize) }
}

#[no_mangle]
pub extern "C" fn seal_request() {
    unsafe {
        let report = &mut *addr_of_mut!(REQUEST);
        report[89] = checksum(report);
    }
}

// The WebHID adapter restores the report-ID byte before copying a 90-byte
// DataView here. Return the device status or a negative validation error.
fn inspect(report: &[u8; REPORT_LEN], tx: u8, class: u8, command: u8) -> i32 {
    if report[0] != 0 || report[6] as usize > MAX_DATA {
        return -1;
    }
    if checksum(report) != report[89] {
        return -2;
    }
    if report[2] != tx || report[7] != class || report[8] != command {
        return -3;
    }
    report[1] as i32
}

#[no_mangle]
pub extern "C" fn inspect_response(tx: u32, class: u32, command: u32) -> i32 {
    if tx > 255 || class > 255 || command > 255 {
        return -1;
    }
    unsafe { inspect(&*addr_of!(RESPONSE), tx as u8, class as u8, command as u8) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reset_matches_captured_report() {
        let mut report = [0; REPORT_LEN];
        assert_eq!(prepare(&mut report, 0, 0x0b, 0, 1), 0);
        report[9] = 1;
        report[89] = checksum(&report);
        assert_eq!(&report[..10], &[0, 0, 0, 0, 0, 0, 1, 0, 0x0b, 1]);
        assert_eq!(report[89], 0x0b);
    }

    #[test]
    fn busy_then_success_and_corruption() {
        let mut report = [0; REPORT_LEN];
        prepare(&mut report, 0, 0x85, 0x1f, 1);
        report[1] = 1;
        report[89] = checksum(&report);
        assert_eq!(inspect(&report, 0x1f, 0, 0x85), 1);
        report[1] = 2;
        report[9] = 1;
        report[89] = checksum(&report);
        assert_eq!(inspect(&report, 0x1f, 0, 0x85), 2);
        report[9] ^= 1;
        assert_eq!(inspect(&report, 0x1f, 0, 0x85), -2);
    }
}
