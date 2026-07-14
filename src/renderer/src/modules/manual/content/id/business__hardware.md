# Hardware Store

Memilih **Hardware Store** sebagai jenis bisnis Anda mengaktifkan **penetapan harga berbasis area**, **penerapan batas kredit**, dan set modul **Logistics** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah toko hardware.

## Harga area (kalkulator P × L)

Toko hardware sering menjual produk yang dihargai per kaki/meter persegi — ubin, lembaran, kaca, tripleks — di mana pelanggan tidak tahu luasnya secara langsung. Di **Billing**, setiap baris keranjang untuk bisnis Hardware menampilkan tombol kecil **Area** di samping stepper kuantitasnya. Mengetuknya membuka kalkulator panjang × lebar: masukkan kedua dimensi, dan Sarang menghitung luasnya serta menetapkannya langsung sebagai kuantitas baris tersebut, dalam satuan apa pun produk itu dijual. Ini tidak mengubah cara produk dihargai — ini adalah kalkulator praktis yang mengisi kuantitas yang benar sehingga Anda tidak perlu aplikasi kalkulator terpisah di konter.

## Penerapan batas kredit

Toko hardware sering menjual kepada kontraktor dan bisnis reguler dengan syarat kredit (bayar nanti). Berikan seorang pelanggan **batas kredit** dari catatannya di **Pelanggan**, dan Sarang akan memblokir penjualan *kredit* baru mana pun yang akan mendorong saldo tertunggak mereka melebihi batas itu — faktur ditolak langsung saat disimpan dengan pesan yang menunjukkan saldo tertunggak mereka saat ini, jumlah faktur baru, dan batas mereka, alih-alih diam-diam diizinkan dan baru disadari kemudian. Pemeriksaan ini hanya berlaku untuk penjualan metode Kredit; penjualan Tunai, UPI, Kartu, dan Split-payment (yang dibayar penuh langsung) tidak pernah terpengaruh. Batas kredit 0 berarti tidak ada batas yang diterapkan untuk pelanggan tersebut.

## Logistics & Supply Chain

Karena template default Hardware mencakup modul Logistics, Anda juga mendapatkan **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, dan **Logistics Analytics** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing.
