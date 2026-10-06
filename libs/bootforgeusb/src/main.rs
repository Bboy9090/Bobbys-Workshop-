use bootforgeusb::scan;

fn main() {
    match scan() {
        Ok(devices) => {
            match serde_json::to_string_pretty(&devices) {
                Ok(json) => println!("{json}"),
                Err(err) => {
                    eprintln!("failed to serialize USB scan: {err}");
                    std::process::exit(2);
                }
            }
        }
        Err(err) => {
            eprintln!("USB scan failed: {err}");
            std::process::exit(1);
        }
    }
}
