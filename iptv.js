const fs = require('fs');
const path = require('path');

// --- CẤU HÌNH ---
const CATEGORY = 'hoat-hinh';
const MAX_PAGES = 100;        // Số trang tối đa bạn muốn quét
const OUTPUT_FILE = 'kkphim.m3u';
const BATCH_SIZE = 5;         // Số phim tải cùng lúc (tránh bị server chặn)

// Hàm tạo thời gian nghỉ (giúp script chạy mượt như người thật)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm tải API có trang bị tính năng "Thử lại nếu lỗi"
async function fetchJson(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.status === 429) { 
                console.log(`[!] Quá nhanh, máy chủ bắt đợi. Đang nghỉ ${2 * (i + 1)} giây...`);
                await delay(2000 * (i + 1));
                continue;
            }
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            if (i === retries - 1) return null;
            await delay(1000); // Lỗi mạng? Đợi 1s rồi thử lại
        }
    }
}

async function start() {
    console.log(`--- BẮT ĐẦU QUÉT KHO PHIM: ${CATEGORY} ---`);
    
    // Khởi tạo file mới và ghi Dòng Tiêu Đề chuẩn của IPTV
    fs.writeFileSync(OUTPUT_FILE, "#EXTM3U\n");

    for (let p = 1; p <= MAX_PAGES; p++) {
        console.log(`\n>> Đang xử lý trang ${p}/${MAX_PAGES}...`);
        const pageData = await fetchJson(`https://phimapi.com/v1/api/danh-sach/${CATEGORY}?page=${p}`);
        
        // Tự động dừng nếu trang web đã hết phim (vd: web chỉ có 80 trang)
        if (!pageData || !pageData.data || !pageData.data.items || pageData.data.items.length === 0) {
            console.log(`[!] Trang ${p} trống. Đã quét cạn kho phim!`);
            break; 
        }

        const movies = pageData.data.items;
        let pageM3uContent = ""; 

        // CHIẾN THUẬT BATCHING: Chia nhỏ ra tải từng đợt để không bị block
        for (let i = 0; i < movies.length; i += BATCH_SIZE) {
            const batch = movies.slice(i, i + BATCH_SIZE);
            const details = await Promise.all(batch.map(m => fetchJson(`https://phimapi.com/phim/${m.slug}`)));

            details.forEach(detail => {
                if (detail && detail.episodes) {
                    const movieName = detail.movie.name;
                    detail.episodes.forEach(server => {
                        server.server_data.forEach(ep => {
                            if (ep.link_m3u8) {
                                pageM3uContent += `#EXTINF:-1 group-title="${movieName}", ${movieName} - ${ep.name}\n${ep.link_m3u8}\n`;
                            }
                        });
                    });
                }
            });
            
            await delay(500); // Nghỉ 0.5s trước khi quét nhóm phim tiếp theo
        }

        // CHIẾN THUẬT CUỐN CHIẾU: Xong trang nào, lưu luôn vào file trang đó
        fs.appendFileSync(OUTPUT_FILE, pageM3uContent);
        console.log(`   -> Đã lưu thành công trang ${p}.`);
        
        await delay(1000); // Nghỉ 1s trước khi sang trang mới để server "thở"
    }

    console.log(`\n--- HOÀN TẤT! File phim siêu to khổng lồ đã sẵn sàng: ${OUTPUT_FILE} ---`);
}

start();
