# Penggajian

Buka **Penggajian** dari sidebar untuk membuat, meninjau, dan membayar gaji bulanan setiap karyawan — dibangun di atas catatan Karyawan dan riwayat Kehadiran yang sama yang dibahas di bab SDM dalam Manual ini. Melihat daftar penggajian dan mencetak slip gaji hanya memerlukan izin **View HR**; membuat penggajian, mengedit potongan, dan menandai slip gaji sebagai dibayar semuanya memerlukan **Manage HR**.

## Memilih periode

Gunakan panah **◀** / **▶** di samping nama bulan untuk berpindah antar periode. Penggajian dibuat dan dilacak satu bulan kalender pada satu waktu, untuk setiap karyawan aktif.

## Membuat penggajian

Ketuk **Buat Penggajian untuk Periode Ini** untuk membuat slip gaji draf untuk setiap karyawan aktif yang belum memilikinya untuk bulan yang dipilih — menjalankannya lagi untuk bulan yang sama hanya mengisi yang kosong, tidak pernah membuat duplikat untuk seseorang yang sudah dibuatkan. **Gaji Kotor** setiap slip gaji adalah Gaji Pokok karyawan ditambah Tunjangan yang dikonfigurasi (keduanya diatur di catatan karyawan itu sendiri), dan berapa banyak dari gaji kotor itu yang sebenarnya diterima karyawan untuk bulan tersebut tergantung pada Jenis Gajinya:

- **Bulanan** — gaji kotor penuh, tidak terpengaruh oleh libur mingguan, hari libur, atau cuti yang disetujui. Ini hanya dikurangi untuk ketidakhadiran nyata yang tidak ditandai: setiap hari **Tidak Hadir** memotong bagian proporsional dari gaji kotor bulan itu, dan setiap **Setengah Hari** memotong setengah dari itu.
- **Harian** — Gaji Pokok diperlakukan sebagai tarif per hari, dibayar hanya untuk hari-hari yang benar-benar ditandai **Hadir** (Setengah Hari dihitung sebagai setengah hari) pada bulan itu, ditambah Tunjangan bulanan tetap di atasnya.
- **Per Jam** — Gaji Pokok diperlakukan sebagai tarif per jam, dihitung dengan cara yang sama seperti Harian tetapi mengasumsikan hari kerja 8 jam untuk setiap hari kehadiran.

Semua ini didorong langsung oleh catatan Kehadiran karyawan tersebut untuk bulan itu — lihat bagian Kehadiran di bab SDM untuk cara pencatatannya hari demi hari.

## Meninjau dan menyesuaikan slip gaji

Ketuk baris karyawan mana pun untuk membuka slip gajinya. Ini menampilkan Gaji Pokok dan setiap baris Tunjangan yang membentuk Gaji Kotor. Selama slip gaji masih berstatus **Draf**, Anda dapat menambahkan **Potongan** — sebuah nama dan jumlah (PF, ESI, Pajak Profesi, dan TDS muncul sebagai tombol tambah-cepat satu ketuk kapan pun model pajak usaha Anda diatur ke GST) — dan menghapus potongan apa pun yang telah Anda tambahkan, dengan total **Gaji Bersih** di bagian bawah dihitung ulang secara langsung seiring Anda melakukannya. Ketuk **Simpan** untuk mencatat perubahan Anda pada daftar potongan.

Penafian yang ditampilkan di bawah daftar potongan sungguh layak dibaca: Sarang menghitung gaji kotor dan menjumlahkan potongan yang Anda masukkan, tetapi tidak menghitung jumlah statutori PF/ESI/TDS untuk Anda — angka-angka itu perlu berasal dari akuntan Anda sendiri atau aturan penggajian Anda, dimasukkan di sini sebagai baris potongan biasa.

## Menandai slip gaji sebagai dibayar

Setelah Anda puas dengan potongannya, pilih **Metode Pembayaran** (Tunai, Transfer Bank, Cek, atau UPI) dan ketuk **Tandai Sudah Dibayar**, lalu konfirmasi. Ini mengunci slip gaji — potongan slip gaji yang sudah dibayar tidak dapat diedit lagi, dan sekarang menampilkan tanggal pembayarannya dan metode yang digunakan, menggantikan editor potongan.

## Mencetak slip gaji

Ketuk ikon printer pada baris mana pun di daftar, atau **Cetak Slip Gaji** di dalam slip gaji yang terbuka, untuk membuat slip gaji yang dapat dicetak untuk karyawan dan periode tersebut — tersedia baik slip gaji masih berupa draf maupun sudah ditandai dibayar.
