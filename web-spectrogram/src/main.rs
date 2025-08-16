#![allow(unexpected_cfgs)]

use std::{net::SocketAddr, path::Path};

use axum::{http::StatusCode, routing::get_service, Router};
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
};

fn app(static_dir: impl AsRef<Path>) -> Router {
    let dir = static_dir.as_ref();
    let service = get_service(
        ServeDir::new(dir)
            .append_index_html_on_directories(true)
            .not_found_service(ServeFile::new(dir.join("index.html"))),
    );

    Router::new()
        .nest_service("/", service)
        .route("/health", axum::routing::get(|| async { StatusCode::OK }))
        .layer(CorsLayer::new().allow_origin(Any))
}

#[cfg(not(tarpaulin))]
#[tokio::main]
async fn main() {
    let app = app("static");
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http::{header, Request};
    use hyper::body::to_bytes;
    use std::fs;
    use tempfile::tempdir;
    use tower::util::ServiceExt;

    #[tokio::test]
    async fn serves_static_and_wasm_with_cors() {
        let tmp = tempdir().unwrap();
        let static_dir = tmp.path().join("static");
        fs::create_dir(&static_dir).unwrap();
        fs::write(static_dir.join("index.html"), "hello").unwrap();
        fs::write(static_dir.join("app.wasm"), b"wasm").unwrap();

        let router = app(&static_dir);

        // GET /
        let res = router
            .clone()
            .oneshot(Request::get("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // GET /health
        let res = router
            .clone()
            .oneshot(Request::get("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // GET wasm file with Origin header
        let res = router
            .oneshot(
                Request::get("/app.wasm")
                    .header(header::ORIGIN, "http://example.com")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .unwrap(),
            "*"
        );
    }

    #[tokio::test]
    async fn serves_index_for_unknown_path() {
        let tmp = tempdir().unwrap();
        let static_dir = tmp.path().join("static");
        fs::create_dir(&static_dir).unwrap();
        fs::write(static_dir.join("index.html"), "index").unwrap();

        let router = app(&static_dir);

        let res = router
            .oneshot(Request::get("/missing").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = to_bytes(res.into_body()).await.unwrap();
        assert_eq!(&body[..], b"index");
    }
}
