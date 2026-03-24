const fs = require('fs');
const path = require('path');

// --- CẤU HÌNH ---
const CATEGORY = 'hoat-hinh';
const PAGES_TO_SCAN = 5;       // Chỉ quét 5 trang đầu để lấy phim mới nhất
const OUTPUT_FILE = 'kkphim.m3u';
const MAX_ITEMS = 5000;        // Giới hạn số lượng phim để TV không bị lag

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        return response.ok ? await response.json() : null;
    } catch (e) { return null; }
}

async function start() {
    console.log(`--- BẮT ĐẦU CẬP NHẬT PHIM MỚI ---`);

    // 1. Đọc dữ liệu cũ đã có
    let oldContent = "";
    if (fs.existsSync(OUTPUT_FILE)) {
        oldContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
    }

    let newEntries = [];
    
    // 2. Quét các trang mới nhất
    for (let p = 1; p <= PAGES_TO_SCAN; p++) {
        console.log(`>> Đang kiểm tra trang phim mới: ${p}...`);
        const data = await fetchJson(`https://phimapi.com/v1/api/danh-sach/${CATEGORY}?page=${p}`);
        if (!data || !data.data.items) break;

        const movies = data.data.items;
        for (const m of movies) {
            // Nếu phim này đã có trong file cũ thì bỏ qua (tiết kiệm thời gian)
            if (oldContent.includes(m.slug)) continue;

            const detail = await fetchJson(`https://phimapi.com/phim/${m.slug}`);
            if (detail && detail.episodes) {
                const movieName = detail.movie.name;
                const poster = detail.movie.thumb_url || detail.movie.poster_url;
                
                detail.episodes.forEach(server => {
                    server.server_data.forEach(ep => {
                        if (ep.link_m3u8) {
                            const entry = `#EXTINF:-1 tvg-logo="${poster}" group-title="${CATEGORY}", ${movieName} - ${ep.name}\n${ep.link_m3u8}\n`;
                            newEntries.push(entry);
                        }
                    });
                });
            }
            await delay(200); // Nghỉ ngắn để tránh bị block
        }
    }

    // 3. Ghép phim mới lên ĐẦU danh sách (để vào app thấy phim mới ngay)
    let finalContent = "";
    if (newEntries.length > 0) {
        console.log(`[+] Tìm thấy ${newEntries.length} tập phim mới!`);
        // Loại bỏ dòng tiêu đề cũ nếu có để ghép cho chuẩn
        const cleanOldContent = oldContent.replace("#EXTM3U\n", "");
        finalContent = "#EXTM3U\n" + newEntries.join("") + cleanOldContent;
    } else {
        console.log(`[!] Không có phim mới nào.`);
        finalContent = oldContent;
    }

    // 4. Giới hạn dung lượng file (Cắt bớt phim cũ nhất nếu quá dài)
    const lines = finalContent.split('\n');
    if (lines.length > MAX_ITEMS * 2) {
        console.log(`[!] Danh sách quá dài, đang tối ưu để TV chạy mượt...`);
        finalContent = lines.slice(0, MAX_ITEMS * 2).join('\n');
    }

    fs.writeFileSync(OUTPUT_FILE, finalContent);
    console.log(`--- HOÀN TẤT! Đã cập nhật phim mới vào ${OUTPUT_FILE} ---`);
}

start();
