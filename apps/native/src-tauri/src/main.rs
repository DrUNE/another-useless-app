// В релизе под Windows не открывать окно консоли.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_native_lib::run()
}
