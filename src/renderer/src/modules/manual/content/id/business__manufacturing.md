# Manufacturing

Manufacturing mengubah Sarang dari sistem beli-dan-jual menjadi sistem buat-dan-jual: Anda melacak bahan baku yang masuk, mendefinisikan apa yang sebenarnya dibutuhkan sebuah produk jadi untuk dibuat, menjalankan perintah produksi yang mengonsumsi bahan dan menghasilkan stok, lalu mengirimkan barang jadi keluar kepada pelanggan. Manufacturing juga mendapatkan set modul Logistics & Supply Chain penuh (Fleet, Carriers, GRN, Freight) secara default, karena menerima konsinyasi bahan baku formal dari pemasok adalah bagian normal dari menjalankan lantai pabrik.

## 1. Raw Materials

**Raw Materials** adalah inventaris bahan/komponen Anda, terpisah dari stok produk reguler Anda. Setiap bahan memiliki nama, satuan (kg, liter, piece, box, dan sejenisnya), tingkat reorder, dan biaya satuan. Daftar menandai apa pun di bawah tingkat reorder-nya dan menjumlahkan nilai stok Anda saat ini.

Stok hanya bergerak melalui **Adjust Stock**, yang mencatat salah satu dari tiga jenis pergerakan — Purchase (stok masuk), Return (stok masuk), atau Adjust To (koreksi manual) — ditambah jenis keempat, Consumed, yang dibuat sistem secara otomatis setiap kali sebuah perintah produksi dimulai (lihat di bawah). Setiap pergerakan dicatat dengan saldo berjalan di **Movement History**, sehingga Anda bisa melihat persis mengapa stok sebuah bahan seperti sekarang.

## 2. Bill of Materials (BOM)

Sebuah BOM mendefinisikan apa yang sebenarnya dibutuhkan sebuah produk jadi: pilih produk, tetapkan kuantitas output per batch, dan daftarkan bahan baku yang dikonsumsinya dengan kuantitas yang dibutuhkan dan persentase wastage opsional. Wastage menggelembungkan kuantitas efektif yang dikonsumsi (misalnya wastage 5% pada kebutuhan 10 kg berarti 10.5 kg yang sebenarnya direncanakan untuk dikonsumsi). Sarang menjumlahkan biaya bahan per batch dari biaya satuan setiap bahan saat ini — ini adalah basis biaya yang akan digunakan sebuah perintah produksi nanti.

Hanya satu BOM per produk yang diizinkan; mengedit BOM yang sudah ada memungkinkan Anda mengubah kuantitas dan wastage tetapi bukan untuk produk mana ia berlaku.

## 3. Production Orders

Ini adalah alur kerja inti manufacturing, dan bergerak melalui empat status:

- **Draft** — Anda memilih produk dengan sebuah BOM dan kuantitas yang direncanakan; Sarang menghitung persis berapa banyak setiap bahan baku yang dibutuhkan rencana tersebut.
- **In Progress** — memulai sebuah perintah memeriksa apakah setiap bahan baku yang dibutuhkan memiliki stok yang cukup; jika ada yang kurang, ia memberi tahu Anda persis apa dan seberapa banyak, dan menolak untuk memulai. Setelah dimulai, bahan baku langsung dikurangi (dicatat sebagai pergerakan "Consumed" terhadap setiap bahan) — ini terjadi saat mulai, bukan saat selesai.
- **Completed** — Anda memasukkan kuantitas yang benar-benar diproduksi (tidak harus sesuai rencana). Sarang menambahkan kuantitas itu ke stok produk jadi dan menghitung ulang biaya rata-ratanya menggunakan rumus rata-rata tertimbang yang sama yang digunakan setiap jalur stok-masuk lain di Sarang, sehingga basis biaya sebuah batch yang diproduksi mengalir dengan benar ke penilaian inventaris dan laporan laba Anda.
- **Cancelled** — tersedia dari Draft atau In Progress, dengan alasan opsional. Membatalkan sebuah perintah yang sudah mengonsumsi bahan baku mengembalikannya ke stok.

Setiap perintah produksi juga bisa membawa daftar periksa opsional dari **langkah perintah kerja** (misalnya "Mixing", "Baking", "Packing") yang Anda centang satu per satu saat produksi benar-benar terjadi di lantai pabrik — ini terpisah dari pelacakan bahan/kuantitas dan murni untuk mengikuti proses fisik.

## 4. Dispatch Tracking

Setelah sebuah produk selesai dan masuk stok, **Dispatch** mencatatnya keluar pintu: pilih produk, sebuah kuantitas, dan secara opsional seorang pelanggan dan tujuan. Sebuah catatan dispatch dimulai sebagai **Ready**, bergerak ke **Dispatched** (ini adalah titik Sarang benar-benar mengurangi kuantitas dari inventaris barang-jadi — bukan saat dibuat), dan akhirnya **Delivered**. Membuat sebuah catatan dispatch memeriksa apakah cukup stok jadi ada sebelum membiarkan Anda melanjutkan.

## 5. Finished Goods

**Finished Goods** mendaftar setiap produk yang memiliki BOM yang didefinisikan untuknya — dengan kata lain, semua yang benar-benar Anda buat alih-alih hanya menjual kembali. Untuk masing-masing Anda bisa melihat stok saat ini, harga jual, dan menampilkan **riwayat produksi** lengkapnya (setiap perintah produksi yang pernah menghasilkannya, kuantitas rencana vs diproduksi, dan status).

## 6. Vendor Management

Layar ini adalah direktori pemasok bahan-baku Anda: setiap pemasok aktif yang memiliki setidaknya satu bahan baku tertaut kepadanya, dengan detail kontak, saldo tertunggak, dan drill-down persis ke bahan mana yang Anda beli dari mereka (dengan stok saat ini, tanda stok-rendah, dan biaya satuan setiap bahan). Ini menggunakan kembali catatan Supplier yang sama seperti bagian Sarang lainnya — tidak ada daftar "vendor manufacturing" terpisah untuk dikelola.

## 7. Production Analytics

Sebuah dasbor aktivitas manufacturing Anda: hitungan perintah berdasarkan status (Draft / In Progress / Completed / Cancelled), **tingkat yield** keseluruhan Anda (total diproduksi ÷ total direncanakan di seluruh perintah selesai), total biaya bahan yang dihabiskan, dan tabel perintah-selesai-terbaru yang menunjukkan persentase yield per-perintah dan biaya-per-unit — berguna untuk menemukan produk mana yang secara konsisten menghasilkan lebih sedikit dari rencana atau berbiaya lebih dari yang diharapkan.
