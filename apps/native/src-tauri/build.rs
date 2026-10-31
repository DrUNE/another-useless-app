fn main() {
    // Объявляем свои команды в манифесте приложения: тогда каждая требует явного разрешения
    // в capabilities (`allow-<имя>`), а не доступна интерфейсу по умолчанию.
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(&["save_url"]));

    // На Windows манифест встраиваем сами (см. ниже), поэтому у tauri-build он отключён: иначе в бинарнике оказались бы два.
    #[cfg(windows)]
    let attributes =
        attributes.windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());

    tauri_build::try_build(attributes).expect("failed to run tauri-build");

    #[cfg(windows)]
    embed_manifest_everywhere();
}

/// Манифест с Common Controls v6 во все исполняемые файлы пакета на Windows, включая тесты библиотеки.
///
/// `tauri-build` встраивает манифест только в бинарники, а тесты библиотеки собираются отдельным exe без него. Загрузчик тогда
/// берёт старую `comctl32`, в которой нет нужной функции, и тест падает при запуске с `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139).
/// Директива для одних тестов (`rustc-link-arg-tests`) не подходит: она относится только к интеграционным тестам из `tests/`,
/// а тесты этого крейта лежат внутри него. Содержимое манифеста то же, что по умолчанию у tauri-build.
/// Предполагается сборка на той же ОС, где она запускается (без кросс-компиляции).
#[cfg(windows)]
fn embed_manifest_everywhere() {
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
    let manifest = out.join("app.manifest");
    fs::write(&manifest, MANIFEST).expect("write the manifest");
    // 24 — тип ресурса RT_MANIFEST, 1 — идентификатор манифеста приложения. Обратные косые в пути экранируются.
    let rc = out.join("app-manifest.rc");
    let path = manifest.display().to_string().replace('\\', "\\\\");
    fs::write(&rc, format!("1 24 \"{path}\"\n")).expect("write the resource script");

    embed_resource::compile_for_everything(rc, embed_resource::NONE)
        .manifest_required()
        .expect("embed the manifest into every executable");
}
