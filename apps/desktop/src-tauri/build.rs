fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    std::env::set_current_dir(&manifest_dir).unwrap();
    if std::env::var_os("REMOVE_UNUSED_COMMANDS").is_some() {
        std::env::set_var("REMOVE_UNUSED_COMMANDS", &manifest_dir);
    }
    tauri_build::build()
}
