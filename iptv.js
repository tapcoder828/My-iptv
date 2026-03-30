const fs = require('fs');
const path = require('path');

const CATEGORY = 'hoat-hinh';
const PAGES_TO_SCAN = 800;    // Tăng vọt lên để lấy lại phim cũ
const OUTPUT_FILE = 'kkphim.m3u';
const MAX_ITEMS = 25000;       

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        return response.ok ? await response.json() : null;
    } catch (e) { return null; }
}

async function start() {
    console.log(`--- ĐANG QUÉT TỔNG LỰC ĐỂ LẤY LẠI KHO PHIM ---`);
    let m3uContent = "#EXTM3U\n";
    let count = 0;

    for (let p = 1; p <= PAGES_TO_SCAN; p++) {
        console.log(`>> Đang cào trang ${p}...`);
        const data = await fetchJson(`https://phimapi.com/v1/api/danh-sach/${CATEGORY}?page=${p}`);
        if (!data || !data.data.items || data.data.items.length === 0) break;

        for (const m of data.data.items) {
            if (count >= MAX_ITEMS) break;
            
            const detail = await fetchJson(`https://phimapi.com/phim/${m.slug}`);
            if (detail && detail.episodes) {
                const movieName = detail.movie.name;
                const poster = detail.movie.thumb_url || detail.movie.poster_url;
                
                detail.episodes.forEach(server => {
                    server.server_data.forEach(ep => {
                        if (ep.link_m3u8) {
                            m3uContent += `#EXTINF:-1 tvg-logo="${poster}" group-title="${CATEGORY}", ${movieName} - ${ep.name}\n${ep.link_m3u8}\n`;
                            count++;
                        }
                    });
                });
            }
            await delay(100); 
        }
        if (count >= MAX_ITEMS) break;
    }

    fs.writeFileSync(OUTPUT_FILE, m3uContent);
    console.log(`--- XONG! Đã lấy được ${count} tập phim. ---`);
}
start();
