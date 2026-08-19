# Pesanan Penjualan & Penetapan Harga

## Pesanan Penjualan

**Pesanan Penjualan** (`/sales-orders`) adalah komitmen untuk menjual — cerminan sisi penjualan dari pesanan pembelian. Gunakan ini ketika pelanggan telah mengonfirmasi ingin sesuatu tetapi Anda belum menagihnya: barang belum siap dikirim, layanan belum dimulai, atau Anda sedang menunggu deposit. Pesanan penjualan tidak pernah menyentuh akun Anda seperti faktur — tidak ada yang ditagih dan tidak ada entri buku besar yang dicatat sampai Anda benar-benar membuat faktur darinya.

Buat satu dengan **Pesanan Penjualan Baru**: pilih pelanggan (atau tambahkan satu tanpa meninggalkan formulir), tanggal yang diharapkan (opsional), dan baris item — masing-masing produk sungguhan atau layanan teks bebas, picker produk-atau-layanan yang sama yang sudah digunakan Penagihan dan pesanan pembelian.

Pesanan penjualan bergerak melalui **Draf → Dikonfirmasi → Sebagian Ditagih → Ditagih**, atau bisa **Dibatalkan** (dengan alasan) di tahap mana pun sebelum ditagih sepenuhnya. Klik **Konfirmasi Pesanan** untuk menguncinya. Dari pesanan yang dikonfirmasi, klik **Buat Faktur** — Anda tidak perlu menagih seluruh pesanan sekaligus: layar penagihan sebagian memungkinkan Anda memilih persis berapa banyak yang ditagih dari setiap baris sekarang, menyisakan sisanya untuk nanti. Layar detail pesanan menyimpan daftar yang selalu diperbarui dari setiap faktur yang dibuat darinya, sehingga Anda selalu bisa melihat berapa banyak dari pesanan asli yang sebenarnya sudah ditagih.

## Daftar Harga

**Daftar Harga** (`/pricing/price-lists`) memungkinkan Anda mengatur penetapan harga berdasarkan tingkat kuantitas untuk pelanggan atau pemasok — misalnya, pelanggan grosir membayar lebih sedikit per unit ketika membeli 50 atau lebih unit dari suatu barang. Buat daftar harga, pilih apakah berlaku untuk pelanggan atau pemasok, lalu gunakan **Kelola Tingkat** untuk mengatur kisi baris {produk, kuantitas minimum, harga}. Tetapkan daftar harga ke pelanggan atau pemasok tertentu dari catatan mereka sendiri.

Saat menentukan harga baris untuk pelanggan atau pemasok dengan daftar harga yang ditetapkan, Sarang menentukan harga secara otomatis: tingkat yang paling cocok dari daftar harga itu sendiri menang terlebih dahulu, lalu kembali ke harga per kelas pelanggan (pendekatan yang lebih sempit dan lebih lama yang sudah digunakan beberapa bisnis) jika tidak ada yang berlaku, dan akhirnya ke harga jual atau biaya normal produk jika keduanya tidak berlaku. Anda tidak pernah perlu memikirkan mana yang "aktif" — yang paling spesifik untuk pelanggan atau pemasok tersebut yang menang.

## Skema Harga

**Skema Harga** (`/pricing/schemes`) adalah penawaran promosi yang dievaluasi secara otomatis saat checkout: **Beli X Dapat Y Gratis** (mis. beli 2, dapat 1 gratis), **Diskon Volume** (mis. diskon 10% untuk 5+ unit, 15% untuk 10+, dengan sebanyak apa pun titik batas yang Anda inginkan), dan **Jam Bahagia / Diskon % Flat** (diskon persentase flat tanpa batas kuantitas — penawaran khas "16.00–18.00, diskon 20%"). Buat skema, batasi ke satu produk atau seluruh kategori, atur aturannya, dan opsional berikan tanggal mulai dan akhir untuk penawaran waktu terbatas, waktu mulai dan akhir harian untuk jendela bergaya jam bahagia (mis. 16.00–18.00 — ini tidak bisa melewati tengah malam), atau keduanya sekaligus.

Saat checkout, menambahkan produk atau kuantitas yang memenuhi syarat ke keranjang menampilkan bilah penawaran yang bisa ditutup dengan tombol **Terapkan** — menerapkan penawaran Beli-X-Dapat-Y-Gratis menambahkan baris gratis untuk Anda; menerapkan penawaran diskon mengatur diskon baris tersebut secara otomatis. Ini selalu hanya saran: tidak ada yang diterapkan sampai Anda mengklik Terapkan, dan diverifikasi secara independen terhadap aturan skema yang sebenarnya dan terkini saat membuat faktur akhir — sebuah skema tidak pernah bisa ditipu untuk mengurangi harga faktur.

## Profil Berulang

**Profil Berulang** (`/recurring-profiles`) menghasilkan faktur, tagihan, atau pengeluaran pada jadwal berulang — mingguan, bulanan, triwulanan, atau tahunan — sehingga Anda tidak perlu membuat ulang dokumen yang sama secara manual setiap periode. Buat satu dengan memilih jenis dokumen, mengisi detail yang sama yang akan Anda isi sekali dalam faktur/tagihan/pengeluaran, dan mengatur pengulangan, tanggal mulai, dan tanggal akhir opsional.

Sarang secara otomatis memeriksa profil yang jatuh tempo saat aplikasi terbuka (kira-kira sekali per jam) dan membuat dokumen secara diam-diam — Anda tidak akan pernah mendapatkan duplikat untuk periode mana pun, bahkan jika aplikasi tertutup saat periode tersebut tiba, karena pemeriksaan berikutnya akan menangkapnya. Klik **Jeda** untuk menghentikan pembuatan profil tanpa menghapusnya, atau **Lanjutkan** untuk mengaktifkannya kembali. Menghapus profil hanya menghentikan pembuatan *masa depan* — dokumen yang sudah dibuat tetap persis seperti apa adanya.

## Alur Kerja Persetujuan

**Alur Kerja Persetujuan** (`/approval-workflows`, biasanya dikonfigurasi oleh Admin) memerlukan persetujuan ketika jumlah total pesanan penjualan atau pesanan pembelian melebihi ambang batas yang Anda tetapkan — berguna ketika lebih dari satu orang dalam bisnis bisa mengikat penjualan atau pembelian. Alur kerja berisi satu atau lebih **langkah**, masing-masing menentukan pemberi persetujuan (berdasarkan peran, mis. "Manajer", atau orang tertentu) dan jumlah pesanan minimum yang memicu langkah tersebut; sebuah langkah dilewati secara diam-diam jika jumlah pesanan tidak mencapai ambang batasnya.

Ketika tidak ada alur kerja yang dikonfigurasi — default untuk setiap instalasi — pesanan penjualan dan pembelian dikonfirmasi segera seperti sebelumnya; fitur ini sepenuhnya opsional. Setelah alur kerja aktif, mengonfirmasi pesanan yang memenuhi syarat memindahkannya ke **Persetujuan Tertunda** alih-alih segera mengonfirmasinya, dan panel persetujuan muncul langsung di layar detail pesanan, mendaftar setiap langkah dan siapa yang harus bertindak. Persetujuan atau penolakan terjadi dari panel yang sama — menolak langkah mana pun menolak seluruh pesanan, tetapi pesanan yang disetujui sepenuhnya menyelesaikan konfirmasi secara otomatis. Alur kerja tanpa riwayat persetujuan masih bisa dihapus langsung; yang sudah pernah digunakan harus dinonaktifkan sebagai gantinya, yang mempertahankan riwayatnya tetapi berhenti berlaku untuk pesanan baru.
