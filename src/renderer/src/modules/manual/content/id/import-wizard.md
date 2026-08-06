# Wizard Impor Data

Buka **Impor** dari sidebar untuk memuat massal Produk, Pelanggan, Pemasok, Inventaris (stok awal), atau Saldo Awal dari file CSV atau Excel (.xlsx) — berguna saat beralih ke Sarang dari sistem lain atau spreadsheet, alih-alih mengetik ratusan catatan satu per satu.

## Langkah 1 — Pilih modul

Pilih tepat satu dari lima jenis impor: **Produk**, **Pelanggan**, **Pemasok**, **Inventaris**, atau **Saldo Awal**. Masing-masing memiliki daftar kolom yang diharapkan sendiri, ditampilkan begitu Anda melanjutkan.

## Langkah 2 — Unggah file Anda

Seret dan lepas file `.csv` atau `.xlsx` ke zona unggah, atau ketuk **Telusuri File** untuk memilih satu dari dialog. Jika Anda belum punya file yang siap, ketuk **Unduh Templat** terlebih dahulu — ini menghasilkan spreadsheet awal dengan header kolom yang benar untuk modul yang Anda pilih.

Panel **Kolom yang diharapkan** mendaftar setiap kolom yang dipahami impor ini untuk modul tersebut, diambil secara langsung sehingga tidak akan pernah ketinggalan zaman dengan apa yang sebenarnya diterima aplikasi. Titik merah dan tanda bintang menandai kolom sebagai wajib; sisanya opsional.

**Peringatan angka nol di depan**: jika nilai SKU, Barcode, atau Telepon Anda memiliki angka nol di depan (seperti `0012`), format kolom tersebut sebagai **Teks** di Excel sebelum menyimpan. Excel secara diam-diam menghapus angka nol di depan dari kolom mana pun yang dibiarkan berformat General atau Number, dan begitu itu terjadi, nilai aslinya tidak bisa dipulihkan — Sarang tidak akan pernah melihat angka nol itu sama sekali.

## Langkah 3 — Petakan kolom

Untuk setiap kolom yang diharapkan Sarang, pilih kolom mana dari file Anda yang mengisinya, menggunakan dropdown di samping setiap nama kolom. Sarang mengisi otomatis pemetaan tebakan terbaik dengan mencocokkan nama header file Anda, sehingga sebagian besar impor hanya perlu pemeriksaan cepat alih-alih memetakan setiap kolom secara manual. Satu kolom hanya bisa dipetakan dari satu sumber pada satu waktu — memilih kolom baru untuk sebuah kolom otomatis menghapus kolom mana pun yang sebelumnya dipetakan ke situ.

## Langkah 4 — Pratinjau

Sarang memvalidasi 20 baris pertama file Anda dan menampilkan masing-masing sebagai **Valid**, **Duplikat** (akan dilewati — catatan yang cocok sudah ada), atau **Kesalahan** (akan dilewati, dengan alasan spesifik yang ditampilkan, seperti kolom wajib yang hilang atau nilai yang formatnya salah). Ini adalah sampel, bukan validasi penuh — ringkasannya secara eksplisit menyatakan hanya 20 baris pertama yang diperiksa, dan baris-baris sisanya divalidasi saat benar-benar diproses saat impor, sehingga jumlah akhir bisa sedikit berbeda dari yang ditunjukkan pratinjau.

## Langkah 5 — Konfirmasi dan jalankan

Sebelum impor benar-benar berjalan, Sarang selalu memastikan cadangan keamanan ada — baik menggunakan kembali cadangan dari 15 menit terakhir, atau membuat yang baru jika belum ada. Tidak ada impor yang berjalan tanpa cadangan ini tersedia.

Mode impor selalu **Buat Saja**: baris yang kuncinya (SKU, telepon, nama — tergantung modul) sudah cocok dengan catatan yang ada akan dilewati, tidak pernah ditimpa. Ini membuat impor aman untuk dijalankan ulang pada file yang sama tanpa risiko menduplikasi atau merusak data yang ada, tetapi ini juga berarti memperbaiki salah ketik pada baris yang sudah diimpor berarti mengedit catatan itu secara langsung setelahnya, bukan mengimpor ulang.

Ketuk **Jalankan Impor** untuk memulai. Bilah kemajuan melacak baris yang diproses dibandingkan total file selama berjalan.

## Langkah 6 — Hasil

Ketika impor selesai, Anda melihat persis berapa banyak baris yang **Diimpor**, **Dilewati** (duplikat), **Gagal** (kesalahan), dan berapa banyak **Peringatan** yang muncul di sepanjang jalan, ditambah daftar yang bisa digulir dari setiap kesalahan baris spesifik jika ada yang terjadi. Dari sini, **Impor File Lain** membawa Anda kembali ke Langkah 1 untuk impor baru, atau **Selesai** menutup wizard.

## Jika ada yang salah

Karena cadangan keamanan selalu dibuat terlebih dahulu, impor yang bermasalah bisa dibatalkan dengan memulihkan cadangan tersebut dari **Pengaturan → Cadangan & Pemulihan** — lihat bab Cadangan & Pemulihan dalam Manual ini.
