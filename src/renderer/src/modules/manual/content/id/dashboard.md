# Dasbor

## Apa yang Anda lihat saat masuk

**Dasbor** adalah layar utama Sarang. Di bagian atas terdapat nama bisnis Anda, tanggal hari ini, dan tombol **Segarkan** yang memaksa pembacaan ulang setiap angka di halaman (angka-angka tersebut biasanya di-cache sebentar demi kecepatan).

Jika **Ask Sarang** (AI Assistant) telah diaktifkan di **Settings → Additional Business Features**, sebuah kotak tanya-cepat muncul tepat di bawah header — ketik pertanyaan berbahasa Inggris sederhana tentang penjualan, stok, pelanggan, atau laba Anda dan itu akan membuka layar **Ask Sarang** dengan jawabannya.

Bisnis baru melihat daftar periksa singkat **Memulai** di sini (tambahkan produk pertama Anda, tambahkan pelanggan, buat faktur pertama Anda) sampai ketiganya selesai atau Anda menutupnya.

## Peringatan

Di atas ubin KPI, Sarang menampilkan sejumlah kecil peringatan yang dapat ditindaklanjuti ketika berlaku untuk Anda, masing-masing berwarna peringatan (kuning) atau bahaya (merah) tergantung tingkat keparahannya:

- **Stok rendah** — satu atau lebih produk berada pada atau di bawah tingkat reorder mereka.
- **Tidak ada cadangan / cadangan terlambat** — tidak pernah ada cadangan yang dibuat, atau sudah lebih lama dari interval pengingat Anda sejak yang terakhir.
- **Saldo tertunggak besar** — total tertunggak pelanggan telah melewati ambang batas.
- **Pengingat tertunda** — pengingat layanan/janji temu dalam antrean tetapi belum dikirim (dengan tautan satu-klik untuk meninjaunya).
- **Kegagalan log audit** — sebuah tindakan baru-baru ini tidak bisa ditulis ke log audit, layak untuk memeriksa ruang disk/izin.
- **Sewa terlambat** — satu atau lebih barang yang disewakan terlambat dikembalikan (bisnis Rental).

## Ubin KPI

Grid utama ubin mencakup: **Penjualan Hari Ini**, **Penjualan Minggu Ini**, **Penjualan Bulan Ini** (masing-masing dengan persentase tren terhadap periode sebelumnya), **Saldo Tertunggak**, **Inventaris** (nilai stok), **Total Pengeluaran** bulan ini, **Estimasi Laba** bulan ini, **Stok Rendah** (sebuah hitungan), **Pelanggan** (sebuah hitungan), dan **Pemasok** (sebuah hitungan). Ubin untuk pendapatan, nilai inventaris, pengeluaran, dan laba disembunyikan di balik tingkat izin Anda — jika Anda tidak memiliki izin analitik yang relevan, ubin menampilkan "—" alih-alih angka daripada dihilangkan sepenuhnya.

Bisnis bertipe Restaurant dengan KOT aktif juga melihat dua ubin tambahan di atas grid untuk KOT yang menunggu dan KOT yang sedang diproses, masing-masing tertaut langsung ke layar pesanan dapur.

## Grafik dan rincian

Di bawah ubin: grafik tren pendapatan-vs-pengeluaran yang bisa Anda beralih antara Hari Ini/Minggu/Bulan/Kuartal/Tahun atau rentang tanggal khusus, dan grafik batang Produk Terlaris. Di bawahnya, rincian Saldo Tertunggak (pelanggan teratas Anda berdasarkan jumlah yang terutang) berada di samping bar Kesehatan Inventaris yang menunjukkan pembagian antara produk aktif, rendah, dan habis stok.

## Aktivitas Terbaru dan Tindakan Cepat

Panel kiri-bawah mendaftar tindakan tercatat terbaru Anda di seluruh sistem (siapa melakukan apa, dan kapan). Panel kanan-bawah memiliki pintasan satu-klik untuk tindakan yang paling sering digunakan pemilik: Faktur Baru, Tambah Produk, Tambah Pelanggan, Laporan, Inventaris, dan Cadangan.

## Sorotan Industri

Sebuah kartu kecil di bawah Tindakan Cepat menyesuaikan dengan jenis bisnis Anda, menampilkan dua hingga empat angka yang benar-benar dicek setiap hari oleh bisnis tersebut — bukan sekumpulan ubin generik. Kini setiap jenis bisnis memiliki kartu nyatanya sendiri; tidak ada yang kembali ke tampilan default seperti Retail. Beberapa contoh:

- **Gym/Studio** — keanggotaan yang berakhir minggu ini dan bulan ini, serta jumlah keanggotaan aktif Anda, tertaut langsung ke layar Keanggotaan.
- **Pengacara** — kasus terbuka dan sidang yang dijadwalkan dalam 7 hari ke depan.
- **Studio Foto** — sesi foto mendatang, sesi yang dijadwalkan bulan ini, dan pengiriman yang menunggu penyuntingan.
- **Sekolah Mengemudi** — peserta didik dengan ujian dalam 14 hari ke depan, dan berapa banyak yang sesi paketnya menipis.
- **Klinik Dokter/Gigi/Fisioterapi/Hewan, Salon Kecantikan, Manajemen Acara, Penjahit/Butik, Pengendalian Hama** — janji temu bulan ini, tingkat penyelesaian, dan ketidakhadiran/pembatalan.
- **Jasa, Konsultan, Arsitek, Insinyur Sipil, Agensi Pemasaran, Agensi Perangkat Lunak, Real Estat** — proyek aktif, selesai bulan ini, dan total nilai kontrak.
- **Hotel/Penginapan** — kamar terisi, tingkat hunian, dan kamar tersedia.
- **Laboratorium Diagnostik** — pesanan tes bulan ini, tertunda, dan terkirim.
- **Lembaga Bimbingan Belajar** — biaya tertunggak, siswa dengan biaya tertunda, dan jumlah diterima bulan ini.
- **Kantor Akuntan Publik / Sekretaris Perusahaan** — tugas kepatuhan terbuka, berapa yang terlambat, dan berapa yang jatuh tempo minggu ini.
- **Bengkel / Pusat Servis Mobil** — kartu pekerjaan bulan ini, tertunda, dan terkirim.
- **Agensi Penempatan Kerja** — kandidat aktif, lowongan kerja terbuka, dan penempatan bulan ini.
- **Restoran, Perhiasan, Perkakas/Kaca/Kayu Lapis, Distributor/Grosir** — mempertahankan kartu lamanya (pendapatan hari ini dan hunian meja; harga logam; tunggakan pelanggan dan nilai inventaris; tagihan tertunggak dan jumlah pemasok).
- **Bisnis umum tanpa kecocokan yang lebih dekat** — jumlah faktur hari ini dan total saldo tertunggak: tetap angka nyata dari data Anda sendiri, bukan placeholder.

Item pertama setiap kartu tertaut langsung ke layar yang diringkasnya.
