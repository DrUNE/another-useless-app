fn main() {
    // Объявляем свои команды в манифесте приложения: тогда каждая требует явного разрешения
    // в capabilities (`allow-<имя>`), а не доступна интерфейсу по умолчанию.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["save_url"])),
    )
    .expect("failed to run tauri-build");

    #[cfg(windows)]
    embed_test_manifest();
}

/// Манифест с Common Controls v6 для тестовых исполняемых файлов на Windows.
///
/// `tauri-build` встраивает манифест приложения только в бинарники, а тесты библиотеки собираются отдельным exe без него.
/// Загрузчик тогда берёт старую `comctl32`, в которой нет нужной функции, и тест падает при запуске с
/// `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139). Предполагается сборка на той же ОС, где она запускается (без кросс-компиляции).
#[cfg(windows)]
fn embed_test_manifest() {
    use std::{env, fs, path::PathBuf};

    const MANIFEST: &str = r#"<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0"
        processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
    </dependentAssembly>
  </dependency>
</assembly>
"#;

    let out = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let manifest = out.join("tests.manifest");
    fs::write(&manifest, MANIFEST).expect("write the test manifest");
    // 24 — тип ресурса RT_MANIFEST, 1 — идентификатор манифеста приложения. Обратные косые в пути экранируются.
    let rc = out.join("tests.rc");
    let path = manifest.display().to_string().replace('\\', "\\\\");
    fs::write(&rc, format!("1 24 \"{path}\"\n")).expect("write the test resource script");

    embed_resource::compile_for_tests(rc, embed_resource::NONE)
        .manifest_required()
        .expect("embed the manifest into test executables");
}
