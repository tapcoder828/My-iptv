const fs = require('fs');
const path = require('path');

// Cấu hình danh mục và số trang
const CATEGORY = 'hoat-hinh';
const PAGES = 2;
const OUTPUT_FILE = 'kkphim.m3u';

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        return null;
    }
}

async function start() {
    console.log(`--- Bắt đầu quét: ${CATEGORY} ---`);
    let m3uContent = "#EXTM3U\n";

    for (let p = 1; p <= PAGES; p++) {
        console.log(`>> Đang xử lý trang ${p}...`);
        const data = await fetchJson(`https://phimapi.com/v1/api/danh-sach/${CATEGORY}?page=${p}`);
        
        if (!data || !data.data.items) continue;

        const movies = data.data.items;

        // Quét chi tiết song song để tăng tốc độ
        const details = await Promise.all(movies.map(m => fetchJson(`https://phimapi.com/phim/${m.slug}`)));

        details.forEach(detail => {
            if (detail && detail.episodes) {
                const movieName = detail.movie.name;
                detail.episodes.forEach(server => {
                    server.server_data.forEach(ep => {
                        if (ep.link_m3u8) {
                            m3uContent += `#EXTINF:-1 group-title="${movieName}", ${movieName} - ${ep.name}\n${ep.link_m3u8}\n`;
                        }
                    });
                });
            }
        });
    }

    fs.writeFileSync(OUTPUT_FILE, m3uContent);
    console.log(`\n--- Hoàn tất! File lưu tại: ${path.resolve(OUTPUT_FILE)} ---`);
}

start();
