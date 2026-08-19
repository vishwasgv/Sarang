# Klinik Gigi

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Klinik Gigi — dimulai dari empat blok bangunan yang sama: **Janji Temu** (memesan dan menjadwalkan kunjungan), sebuah **Katalog Layanan** (daftar prosedur gigi dan harganya), **Provider Schedules** (dokter gigi mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas dua alat khusus-gigi Sarang: bagan gigi dan jadwal recall.

## Tooth Chart

Setiap pasien gigi memiliki tab **Tooth Chart** yang menampilkan bagan gigi notasi FDI lengkap — baik lengkung permanen (dewasa) maupun lengkung desidui (gigi susu/primer), atas dan bawah. Klik gigi mana pun untuk mencatat atau memperbarui kondisinya:

- Kondisi: Sound, Caries, Filled, Missing, Crown, Bridge (abutment), Implant, Root Canal, Extraction Site, Fracture — masing-masing ditampilkan dengan warnanya sendiri di bagan.
- Untuk kondisi apa pun selain Sound atau Missing, tandai **permukaan** mana yang terpengaruh (Buccal, Lingual, Mesial, Distal, Occlusal).
- Tambahkan catatan klinis teks bebas per gigi.

Sebuah legenda di atas bagan menunjukkan arti setiap warna, dan Anda dapat **Print Chart** kapan saja untuk cetakan tabular setiap gigi dengan kondisi tercatat (non-Sound) — berguna untuk rujukan atau catatan pasien.

Klik **History** pada gigi mana pun untuk melihat linimasa kronologis lengkapnya — bukan hanya perubahan kondisinya, tetapi juga setiap prosedur rencana perawatan yang pernah menyebutkan gigi ini, digabungkan dalam satu linimasa, terbaru lebih dulu. Entri kondisi menampilkan kondisi dan catatan apa pun; entri perawatan menampilkan prosedur dan dari rencana mana asalnya, ditandai **Treatment Planned** atau **Treatment Done** sesuai status prosedur itu sendiri. Menyimpan ulang sebuah gigi (katakanlah, dari Caries ke Filled setelah perawatan) tidak pernah menghapus entri sebelumnya; keduanya tetap dalam linimasa sehingga Anda memiliki kisah lengkap gigi tersebut — apa yang ditemukan, apa yang diusulkan untuknya, dan apa yang sebenarnya dilakukan.

## Treatment Plans

Tab **Treatment Plans** pada layar pasien yang sama memungkinkan Anda membangun rencana perawatan berbutir: sebuah judul, status (Proposed / Accepted / In Progress / Completed / Declined), dan daftar prosedur, masing-masing opsional terkait dengan nomor gigi tertentu, dengan estimasi biaya sendiri dan penanda Pending/Done. Total estimasi biaya rencana dihitung otomatis dari item barisnya. Setelah sebuah rencana ada, lampirkan file pendukung ke dalamnya — rontgen, formulir persetujuan yang dipindai — langsung dari tampilan editnya.

Begitu sebuah rencana melewati Proposed (Accepted, In Progress, atau Completed) dan belum ditagih, sebuah aksi **Generate Invoice** muncul padanya — satu klik mengubah prosedur berharga dalam rencana menjadi faktur sungguhan untuk pasien tersebut, satu baris per prosedur (ditandai gigi jika diatur), dan rencana tersebut kemudian menampilkan lencana **Billed**. Sebuah rencana hanya dapat ditagih sekali; rencana yang masih di Proposed sama sekali tidak dapat ditagih, karena itu akan diam-diam menganggap pasien sudah setuju.

## Recall Schedule

Tab **Recall** (dan layar **Jadwal Panggilan Ulang** mandiri, yang mendaftar recall setiap pasien di seluruh klinik) adalah sistem pengingat recall gigi Sarang — alur kerja "kembali untuk pembersihan 6-bulanan Anda" sehari-hari. Untuk setiap pasien Anda menetapkan:

- **Recall Type** — 6-Month Hygiene, 12-Month Hygiene, Crown Review, atau Custom.
- **Last Visit Date** dan **Next Recall Date**.
- Catatan opsional.

Layar Recall Schedule mengelompokkan setiap pasien ke dalam **Terlambat**, **Due Soon** (dalam 7 hari), **Bulan Ini** (dalam 30 hari), atau **Upcoming**, dengan jumlah dan lencana berwarna-kode untuk setiap kelompok, sehingga Anda selalu tahu siapa yang harus dihubungi berikutnya. Sebuah lencana "Reminded" muncul setelah pengingat dikirim untuk recall pasien tersebut.

Setiap kali Anda memperbarui recall pasien yang sudah memiliki satu recall tercatat, Sarang secara diam-diam mencatat apakah periode recall yang ditutup itu terpenuhi tepat waktu — Last Visit Date baru dibandingkan dengan tanggal recall yang jatuh tempo sebelum pembaruan Anda. Anda tidak akan pernah melihat ini secara langsung; ini menjadi data untuk laporan Kepatuhan Panggilan Ulang di bawah.

## Laporan

Buka **Reports → Treatment Acceptance Rate** untuk melihat berapa banyak rencana perawatan yang Anda usulkan dalam rentang tanggal yang benar-benar menjadi pendapatan yang ditagih — funnel tiga tahap (Proposed → Accepted → Billed) sebagai grafik batang, ditambah tingkat penerimaan (diterima ÷ diusulkan) dan tingkat penagihan (ditagih ÷ diusulkan) dalam persentase. Ini adalah data rencana sungguhan yang sama dari tab Treatment Plans, diagregasi alih-alih dibaca satu pasien pada satu waktu — gambaran cepat apakah presentasi kasus Anda berhasil dikonversi, dan apakah rencana yang diterima benar-benar sampai pada pembayaran.

Buka **Reports → Recall Compliance** untuk melihat, dari periode panggilan ulang yang ditutup dalam rentang tanggal, berapa persen pasien yang benar-benar kembali pada atau sebelum tanggal jatuh tempo mereka — satu ukuran untuk persentase keseluruhan, ditambah pembagian berdasarkan Jenis Panggilan Ulang (6-Month Hygiene, 12-Month Hygiene, Crown Review, Custom). Hanya periode panggilan ulang yang benar-benar ditutup (pasien dengan panggilan ulang yang ada mendapatkan yang baru) yang dihitung dalam hal ini — panggilan ulang pertama pasien tidak memiliki tanggal jatuh tempo sebelumnya untuk dibandingkan, jadi tidak dihitung di kedua sisi.
