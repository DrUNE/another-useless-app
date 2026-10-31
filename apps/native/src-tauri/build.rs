fn main() {
    // Объявляем свои команды в манифесте приложения: тогда каждая требует явного разрешения
    // в capabilities (`allow-<имя>`), а не доступна интерфейсу по умолчанию.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["save_url"])),
    )
    .expect("failed to run tauri-build");
}
