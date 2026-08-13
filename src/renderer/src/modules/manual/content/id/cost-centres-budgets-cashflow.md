# Pusat Biaya, Anggaran & Arus Kas

## Pusat Biaya

**Pusat Biaya** (`/cost-centres`) adalah tag — sebuah departemen, cabang, atau proyek — yang dapat Anda lampirkan ke faktur, tagihan, pengeluaran, atau karyawan untuk melihat laba dan pengeluaran yang dirinci berdasarkan tag tersebut, bukan hanya secara keseluruhan perusahaan. Setiap usaha dimulai dengan nol pusat biaya, jadi tidak ada apa pun di sini yang muncul di tempat lain sampai Anda membuat pusat biaya pertama Anda dengan **Pusat Biaya Baru** (sebuah nama dan kode singkat opsional).

Setelah setidaknya satu pusat biaya ada, pemilih **Pusat Biaya** opsional muncul di layar checkout faktur, formulir Tagihan, formulir Pengeluaran, dan formulir Karyawan — biarkan kosong dan tidak ada yang berubah; pilih satu dan setiap entri akuntansi yang dibuat oleh transaksi tersebut membawa tag yang sama. Pusat biaya milik seorang karyawan juga secara otomatis memberi tag pada pengeluaran gajinya saat penggajian menandainya sebagai dibayar, sehingga biaya kepegawaian terkumpul per departemen tanpa perlu memberi tag ulang setiap slip gaji secara manual.

## Anggaran

**Anggaran** (`/budgets`) memungkinkan Anda merencanakan angka bulanan — untuk pusat biaya tertentu, akun tertentu, atau seluruh perusahaan — lalu melihat bagaimana pengeluaran aktual dibandingkan dengannya setelah bulan berjalan. Pilih bulan dengan panah di bagian atas, lalu **Anggaran Baru** untuk menetapkan jumlah terhadap sebuah cakupan: biarkan Pusat Biaya dan Akun kosong keduanya untuk angka seluruh perusahaan, tetapkan hanya Pusat Biaya untuk anggaran seluruh departemen, atau tetapkan keduanya untuk cakupan yang lebih sempit. Daftar menampilkan Dianggarkan, Aktual, dan Selisih berdampingan untuk bulan yang sedang Anda lihat — Aktual selalu berupa data transaksi nyata, tidak pernah diperkirakan, jadi anggaran terhadap pusat biaya yang belum memiliki pengeluaran apa pun secara jujur menampilkan nol, bukan kekosongan.

Anda tidak dapat membuat dua anggaran untuk cakupan dan periode yang persis sama — edit yang sudah ada sebagai gantinya, sehingga "berapa yang kita anggarkan untuk Marketing bulan ini" selalu memiliki satu jawaban.

## Laporan Laba Rugi Pusat Biaya

Di bawah Laporan, **Laba Rugi Pusat Biaya** menampilkan pendapatan, pengeluaran, dan margin aktual per pusat biaya untuk rentang tanggal apa pun yang Anda pilih, diambil dari transaksi bertag yang sama yang dibaca layar Anggaran. Pendapatan dan pengeluaran yang tidak pernah diberi tag ke pusat biaya mana pun ditampilkan secara terpisah sebagai total "tanpa tag", bukan dihilangkan secara diam-diam — sehingga total laporan selalu memperhitungkan segalanya, baik diberi tag maupun tidak.

## Ringkasan Kepatuhan Statuter

Sarang tidak pernah menerapkan aturan resmi pemerintah untuk PF/ESI/Pajak Profesi secara otomatis — aturan itu berubah setiap ada pemberitahuan pemerintah, dan angka yang salah namun disajikan dengan percaya diri lebih buruk daripada kolom kosong. Sebagai gantinya, jika Anda memasukkan % PF, % ESI (dengan batas upah opsional), dan jumlah Pajak Profesi Anda sendiri di **Settings → Business Profile**, layar Penggajian mendapatkan tautan **Sarankan dari tarif statuter** di samping bagian Potongan setiap slip gaji. Ini mengisi terlebih dahulu baris potongan yang disarankan dari tarif yang Anda konfigurasi sendiri — Anda tetap meninjau, mengedit, atau menghapus baris mana pun, dan tetap harus menekan Simpan agar itu berlaku. Tidak ada yang pernah disarankan untuk tarif yang belum Anda tetapkan.

Laporan **Ringkasan Kepatuhan Statuter** (di bawah Laporan) menjumlahkan apa yang benar-benar Anda catat — setiap baris potongan di setiap slip gaji untuk bulan tersebut, dikelompokkan berdasarkan nama — sebagai angka kewajiban pemberi kerja yang nyata untuk PF, ESI, Pajak Profesi, atau apa pun lain yang Anda beri nama sebagai potongan, baik itu berasal dari saran maupun diketik manual.

## Proyeksi Arus Kas

Laporan **Proyeksi Arus Kas** (di bawah Laporan) menampilkan grafik harian yang dibagi menjadi dua bagian yang bertemu di hari ini: garis padat pergerakan kas **aktual** untuk bulan lalu (uang yang benar-benar diterima dikurangi pengeluaran dan pembayaran pemasok yang benar-benar dibayarkan), dan garis putus-putus kas **yang diproyeksikan** untuk bulan mendatang — dibangun dari faktur dan tagihan terbuka berdasarkan tanggal jatuh temponya masing-masing, ditambah pengeluaran berulang apa pun yang dijadwalkan jatuh tempo dalam rentang tersebut. Ini adalah tampilan perencanaan, bukan jaminan: hanya dokumen dengan tanggal jatuh tempo nyata yang diproyeksikan, dan hanya profil *pengeluaran* berulang yang diramalkan (jumlah total masa depan yang tepat dari faktur atau tagihan berulang tidak diperkirakan, untuk menghindari angka yang salah namun disajikan dengan percaya diri).

## Kinerja Pembayaran

Laporan **Kinerja Pembayaran** (di bawah Laporan) menampilkan, per pelanggan, berapa hari yang benar-benar dibutuhkan untuk menagih faktur secara penuh — diukur dari tanggal faktur hingga tanggal pembayaran *terakhir*nya, sehingga pelanggan yang membayar dalam tiga cicilan hanya dihitung setelah mereka benar-benar selesai membayar. Faktur yang masih memiliki saldo muncul sebagai belum lunas, bukan mengaburkan rata-rata dengan pembayaran yang belum selesai. Gunakan ini untuk melihat pelanggan mana yang secara konsisten membayar cepat dan mana yang secara konsisten membutuhkan waktu paling lama, baik per pelanggan maupun sebagai satu rata-rata keseluruhan.
