// src/main.rs

use axum::{response::Html, routing::get, Router};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

// Declare the modules
mod content;
mod social_links;

#[tokio::main]
async fn main() {
    // Define the router
    let app = Router::new()
        .route("/", get(handler))
        // Serve static files from the `static` directory
        .nest_service("/static", ServeDir::new("static"));

    // --- CHANGE HERE: Listen on localhost only ---
    // Define the address and start the server
    // Use 127.0.0.1 when running behind a local reverse proxy like Nginx
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    // If you were NOT using Nginx and wanted direct access, you'd use:
    // let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    // --- End Change ---

    println!("Server configured to listen on http://{}", addr);
    let listener = match TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(e) => {
            eprintln!("FATAL: Failed to bind to address {}: {}", addr, e);
            eprintln!("Ensure port 3000 is free and the address is correct.");
            return;
        }
    };
    println!("Successfully bound to address. Starting server...");


    // Run the server
    axum::serve(listener, app)
        .await
        .unwrap_or_else(|e| eprintln!("Server error: {}", e));
}

// The handler now dynamically builds the HTML using content from modules
async fn handler() -> Html<String> {
    // Use the constants from the modules
    let paragraph1 = content::PARAGRAPH_1;
    let paragraph2 = content::PARAGRAPH_2;
    let social_links = social_links::SOCIAL_LINKS_HTML;

    // Construct the HTML using format!
    // Link to the external CSS and JS files
    let html_content = format!(
        r#"
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nils Adam</title>

            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />

            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..1000&display=swap" rel="stylesheet">

            <!-- Google Fonts: Roboto for body text (Regular weight) -->
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap" rel="stylesheet">

            <!-- Link to external CSS file -->
            <link rel="stylesheet" href="/static/css/style.css">

        </head>
        <body>
            <div class="content">
                <div class="title-container">
                <canvas id="debug-canvas"></canvas>
                    <div class="title-wrapper">
                        <span class="letter" data-char="N">N</span>
                        <span class="letter" data-char="I">I</span>
                        <span class="letter" data-char="L">L</span>
                        <span class="letter" data-char="S">S</span>
                        <span class="letter-spacer"></span>
                        <span class="letter" data-char="A">A</span>
                        <span class="letter" data-char="D">D</span>
                        <span class="letter" data-char="A">A</span>
                        <span class="letter" data-char="M">M</span>

                    </div>
                </div>
                <p>
                    {}
                </p>
                <p>
                    {}
                </p>

                <div class="social-links">
                     {}
                </div>

            </div>

            <!-- Link to external JavaScript file -->
            <script src="/static/js/physics.js"></script>
        </body>
        </html>
        "#,
        paragraph1, paragraph2, social_links
    );

    Html(html_content)
}