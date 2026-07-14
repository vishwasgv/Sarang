# Settings & Profil Bisnis

Segala sesuatu yang membentuk cara Sarang berperilaku untuk bisnis Anda berada di bawah **Settings**, yang dapat diakses dari sidebar. Layar Settings memiliki menu sisi kiri sendiri berisi bagian-bagian — klik salah satu untuk membukanya.

## Business Profile

**Settings → Business Profile** menyimpan detail yang tercetak pada setiap faktur dan struk: nama bisnis, nama pemilik, telepon, email, nomor GST/PPN, ID UPI, situs web, dan alamat lengkap (alamat, kota, provinsi, kode pos). Anda juga dapat mengunggah logo bisnis (JPG, PNG, atau WebP, di bawah 2MB) dan memilih apakah logo tersebut ditampilkan di Dasbor dan/atau sebagai watermark tipis pada dokumen yang dicetak.

Jika jenis bisnis Anda adalah **Specialist Clinic**, muncul kolom tambahan **Specialty** (misalnya Pediatri, Ortopedi, THT). Klik **Edit** untuk mengubah salah satu kolom ini, lalu **Save Changes**. Negara, mata uang, dan model pajak ditampilkan di sini hanya sebagai referensi tetapi diubah masing-masing dari bagian **Currency & Locale** dan **Tax Configuration**.

## Tax Configuration

**Settings → Tax Configuration** mengelola tarif GST/PPN/pajak-penjualan yang tersedia saat penagihan. Tambahkan sebuah pajak dengan nama (misalnya "GST 18%"), sebuah jenis (GST, VAT, Sales Tax, Custom, atau None), tarif antara 0–100%, dan secara opsional sebuah negara dan tanda "default untuk jenis pajak ini". Faktur yang sudah ada tidak pernah terpengaruh ketika Anda mengedit atau menghapus sebuah tarif pajak — menghapus hanya menonaktifkannya untuk ke depannya.

## Currency & Locale

**Settings → Currency & Locale** menetapkan mata uang Anda (Sarang mendukung sekitar 150 mata uang dunia), format angka Anda (pengelompokan gaya India seperti 1,00,000.00, US/Internasional, Eropa, Inggris, Arab, atau Indonesia), dan jumlah desimal (0, 2, atau 3). Pratinjau langsung menunjukkan persis bagaimana sebuah jumlah akan diformat sebelum Anda menyimpan.

## Industry Template

**Settings → Industry Template** adalah tempat Anda memilih jenis bisnis Anda — Restaurant, Retail, Pharmacy, Hardware, Distributor, Hotel/Lodge, Jewellery, Manufacturing, salah satu jenis layanan profesional (Lawyer, Architect, CA Firm, dan banyak lagi), dan sebagainya. Setiap template mengaktifkan sekumpulan modul fitur tertentu — misalnya, Restaurant mengaktifkan Table Management, pencetakan KOT, dan pelacakan resep/bahan, sementara Pharmacy mengaktifkan pelacakan batch dan kedaluwarsa. Layar ini menampilkan daftar modul yang tepat di bawah setiap opsi sehingga Anda tahu persis apa yang Anda dapatkan.

Beralih template langsung mengubah navigasi sidebar dan set fitur Anda — tanpa perlu restart — dan **semua data yang ada tetap dipertahankan**, hanya fitur mana yang terlihat yang berubah. Karena ini adalah pilihan single-select, beralih ke template baru menggantikan set modul Anda saat ini alih-alih menambahkannya (sebuah toko Retail yang beralih ke Distributor kehilangan modul Returns khusus Retail kecuali diaktifkan juga secara terpisah — lihat di bawah).

## Additional Business Features

**Settings → Additional Business Features** memungkinkan Anda menambahkan modul fitur dari jenis bisnis lain di atas apa yang sudah diberikan Industry Template Anda — berguna jika bisnis Anda memang mencakup lebih dari satu jenis (misalnya toko retail yang juga melakukan perdagangan grosir/dealer). Toggle ini independen dari Industry Template Anda dan dapat diaktifkan atau dinonaktifkan kapan saja:

- **Returns Workflow** — menerima retur produk dengan pembalikan inventaris dan buku besar otomatis.
- **Area Pricing Calculator** — harga berdasarkan area (sq ft / sq m), berguna untuk kaca, tripleks, atau ubin.
- **Credit Limit Enforcement** — memblokir penjualan kredit baru begitu saldo tertunggak pelanggan akan melebihi batas kredit yang ditetapkan. Hanya memengaruhi pelanggan yang benar-benar memiliki batas kredit yang ditetapkan; pelanggan walk-in secara default tidak memiliki batas dan tidak pernah diblokir.
- **Bulk Order Workflow** — layar pesanan grosir terpisah dengan tingkatan diskon berbasis volume untuk pelanggan grosir/dealer.
- **Outstanding Analytics** — pelaporan tambahan tentang saldo tertunggak pelanggan dan usianya (aging).
- **Logistics & Supply Chain** — sebuah paket yang mencakup fleet, ekspedisi, pengiriman, penerimaan barang (GRN), surat jalan, dan pelacakan ongkos angkut, untuk bisnis mana pun yang memindahkan barang dengan kendaraannya sendiri atau ingin melacak secara formal pengiriman dari pemasok.

Dua fitur lintas-sektor lainnya memiliki bagian Settings khusus sendiri alih-alih berada dalam daftar ini: **Barcode & Loose Billing** dan **AI Assistant** (lihat di bawah, dan bab manualnya masing-masing). Menonaktifkan fitur-fitur ini tidak menghapus data yang ada — hanya menyembunyikan layar dan alur kerja terkait.

## Barcode & Loose Billing

**Settings → Barcode & Loose Billing** adalah tempat Anda opt-in untuk pembuatan barcode, pencetakan label barcode, dan penagihan lepas/berbasis berat. Ketiganya nonaktif secara default untuk setiap jenis bisnis. Lihat bab *Barcode & Loose/Weight Billing* untuk detail lengkap penggunaannya setelah diaktifkan.

## AI Assistant

**Settings → AI Assistant** mengaktifkan **Ask Sarang**, asisten tanya-jawab offline atas data bisnis Anda sendiri. Nonaktif secara default. Lihat bab *Ask Sarang (AI Assistant)* untuk apa saja yang bisa dijawabnya.

## Language

**Settings → Language** mendukung 13 bahasa: English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Gujarati, Spanish, French, Arabic, Portuguese, dan Indonesian. Bahasa dikelompokkan ke dalam daftar **Global** dan **Indian Languages**. Memilih sebuah bahasa langsung mengubah antarmuka — tanpa perlu restart. Memilih Arabic juga otomatis mengubah seluruh antarmuka ke tata letak kanan-ke-kiri.

## Appearance

**Settings → Appearance** memiliki dua kontrol:

- **Dark Mode** — sakelar untuk skema warna gelap.
- **Print Type** — pilih antara **A4 Invoice** (halaman penuh, berwarna), **Thermal 80mm** (lebar struk POS standar), atau **Thermal 58mm** (lebar struk POS sempit). Ini menentukan format yang digunakan setiap kali Anda mencetak faktur atau struk.

Kedua preferensi disimpan secara otomatis dan diingat pada saat berikutnya Anda membuka Sarang.

## Users & Roles, Security, dan Backup

Tiga bagian lainnya berada dalam menu Settings yang sama tetapi dibahas di bab masing-masing: **Users & Roles** (lihat *Pengguna & Hak Akses*), **Security** — tempat Anda mengubah kata sandi Anda sendiri (lihat *Pengguna & Hak Akses*), dan **Backup & Recovery**, yang membuka layar Backup khusus (lihat *Cadangan & Pemulihan*).

## About

**Settings → About** menampilkan nomor versi terpasang Anda dan pernyataan transparansi Sarang (data apa yang dikumpulkan dan tidak dikumpulkan — tidak ada, karena Sarang sepenuhnya offline).
