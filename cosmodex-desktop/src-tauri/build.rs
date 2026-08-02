use std::io::Read;

fn main() {
    // Bake OAuth creds from the gitignored .env into the binary as compile-time
    // env vars (read via env!() in lib.rs). Keeps the secret out of tracked
    // source and out of the public web bundle.
    if let Ok(mut f) = std::fs::File::open(".env") {
        let mut s = String::new();
        let _ = f.read_to_string(&mut s);
        for line in s.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                println!("cargo:rustc-env={}={}", k.trim(), v.trim());
            }
        }
        println!("cargo:rerun-if-changed=.env");
    }
    tauri_build::build()
}
