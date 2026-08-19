# Hardware Store

Memilih **Hardware Store** sebagai jenis bisnis Anda mengaktifkan **penetapan harga berbasis area**, **penerapan batas kredit**, dan set modul **Logistik** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah toko hardware.

## Harga area (kalkulator P × L)

Toko hardware sering menjual produk yang dihargai per kaki/meter persegi — ubin, lembaran, kaca, tripleks — di mana pelanggan tidak tahu luasnya secara langsung. Di **Penagihan**, setiap baris keranjang untuk bisnis Hardware menampilkan tombol kecil **Luas** di samping stepper kuantitasnya. Mengetuknya membuka kalkulator panjang × lebar: masukkan kedua dimensi, dan Sarang menghitung luasnya serta menetapkannya langsung sebagai kuantitas baris tersebut, dalam satuan apa pun produk itu dijual. Ini tidak mengubah cara produk dihargai — ini adalah kalkulator praktis yang mengisi kuantitas yang benar sehingga Anda tidak perlu aplikasi kalkulator terpisah di konter. Kalkulator yang sama juga tersedia saat menyusun sebuah **Penawaran**, sehingga perkiraan harga berbasis-area sama mudahnya disusun seperti penjualan langsung.

Jika Anda memiliki izin untuk melihat angka laba, kalkulator juga menampilkan **pratinjau margin** langsung begitu kedua dimensi terisi — persentase margin pasti yang akan diperoleh baris ini pada luas yang dihitung dan harga baris saat ini, diberi kode warna (hijau/kuning/merah) sehingga Anda bisa mengenali margin tipis atau negatif sebelum menyelesaikan penjualan. Kasir tanpa izin melihat laba tidak akan pernah melihat baris ini, sama seperti angka margin disembunyikan dari mereka di tempat lain di Sarang.

## Konversi satuan karton/boks

Jika Anda membeli dalam karton tetapi menjual per satuan, aktifkan **pack billing** untuk sebuah produk dan atur berapa banyak satuan dalam satu pak. Saat Anda menerima stok, Stock Adjustment menawarkan mode entri "packs received" — masukkan jumlah pak/karton dan Sarang menghitungkan jumlah satuan yang setara untuk Anda. Semua yang lain (penagihan, peringatan stok rendah, valuasi) tetap bekerja dalam satuan seperti biasa; ini hanya mengubah cara Anda *memasukkan* stok yang baru diterima.

Dua tempat membaca ukuran karton yang sama ini untuk memberi Anda angka yang lebih cerdas dan sadar-karton, bukan hanya jumlah satuan biasa. Di **Laporan → Laporan Inventaris**, stok produk yang ditagih per pak menampilkan kedua bentuk bersamaan — mis. "100 (4 karton + 4 pcs)" — sehingga Anda bisa melihat sekilas apakah Anda sudah sampai pada satuan lepas dari karton yang terbuka, tanpa perlu membagi sendiri. Dan saat Anda menggunakan **Inventory → Generate Reorder POs** untuk produk yang ditagih per pak yang telah turun di bawah level pemesanan ulangnya, kuantitas pesanan yang disarankan secara otomatis dibulatkan ke atas menjadi kelipatan karton penuh — pemasok menjual karton utuh, bukan jumlah satuan pecahan, jadi draf yang meminta "37 pcs" sebenarnya tidak pernah bisa benar-benar dipesan sebagaimana tertulis.

## Penghapusan kerusakan/kerugian

Saat menyesuaikan stok turun karena kerusakan atau kerugian yang sebenarnya, bukan koreksi rutin, pilih **Damage** sebagai kategori alasan pada formulir Stock Adjustment. Ini mencatatnya secara terpisah dari penyesuaian umum, sehingga riwayat Inventory Movements dan laporan Anda bisa membedakan kerugian akibat kerusakan dari koreksi stok biasa.

## Penerapan batas kredit

Toko hardware sering menjual kepada kontraktor dan bisnis reguler dengan syarat kredit (bayar nanti). Berikan seorang pelanggan **batas kredit** dari catatannya di **Pelanggan**, dan Sarang akan memblokir penjualan *kredit* baru mana pun yang akan mendorong saldo tertunggak mereka melebihi batas itu — faktur ditolak langsung saat disimpan dengan pesan yang menunjukkan saldo tertunggak mereka saat ini, jumlah faktur baru, dan batas mereka, alih-alih diam-diam diizinkan dan baru disadari kemudian. Pemeriksaan ini hanya berlaku untuk penjualan metode Kredit; penjualan Tunai, UPI, Kartu, dan Split-payment (yang dibayar penuh langsung) tidak pernah terpengaruh. Batas kredit 0 berarti tidak ada batas yang diterapkan untuk pelanggan tersebut.

Begitulah tepatnya cara kerja **rekening berjalan** kontraktor sehari-hari: setiap penjualan kredit langsung ditambahkan ke saldo mereka saat terjadi — tanpa perlu pengaturan "rekening berjalan" terpisah. Saat tiba waktunya menyelesaikan pembayaran, buka **Laporan → Buku Besar Pelanggan**, cari kontraktor tersebut, dan pilih rentang tanggal yang ingin Anda tagihkan (satu bulan, atau periode lainnya) — ini menghasilkan laporan lengkap dengan saldo awal, setiap transaksi berurutan, saldo akhir, dan grafik tren saldo, sudah terperinci per item dan dijumlahkan, siap diserahkan atau diekspor sebagai PDF.

## Matriks produk perputaran cepat vs. lambat

Di **Laporan → Matriks Produk Perputaran Cepat vs. Lambat**, setiap produk yang terjual dalam rentang tanggal yang Anda pilih diplot sebagai titik — seberapa cepat terjual (unit per hari) pada satu sumbu, dan persentase marginnya pada sumbu lainnya. Garis putus-putus menandai median kecepatan dan median margin untuk periode tersebut, membagi grafik menjadi empat kuadran: perputaran cepat dengan margin bagus, perputaran cepat tapi margin tipis, perputaran lambat tapi masih layak dipertahankan karena marginnya, dan perputaran lambat dengan margin tipis juga — biasanya kandidat paling jelas untuk dihentikan atau dijual habis. Tabel di bawah grafik mencantumkan setiap produk dengan kecepatan, margin, dan kuadran yang tepat, jadi Anda tidak perlu hanya menerka-nerka dari titik-titiknya.

## Logistics & Supply Chain

Karena template default Hardware mencakup modul Logistics, Anda juga mendapatkan **Armada**, **Kurir**, **Pengiriman**, **Nota Penerimaan Barang**, **Surat Jalan**, **Buku Besar Ongkir**, dan **Analitik Logistik** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing.
