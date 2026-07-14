# Retail

Memilih **Retail** sebagai jenis bisnis Anda mengaktifkan **Returns** ditambah set modul **Logistics** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah toko retail.

## Returns

Buka **Retur** dari sidebar untuk memproses retur atau penukaran pelanggan terhadap penjualan lampau. Cari faktur asli berdasarkan nomor fakturnya, dan Sarang memuat item-itemnya dengan kuantitas **Max Return** untuk masing-masing — ini adalah kuantitas asli dikurangi apa pun yang sudah diretur terhadap faktur yang sama pada kunjungan sebelumnya, sehingga Anda tidak akan pernah tidak sengaja meretur lebih banyak item daripada yang benar-benar dibeli pelanggan (Sarang juga memeriksa dan memblokir ini saat menyimpan, bukan hanya di stepper kuantitas).

Pilih kuantitas untuk diretur untuk setiap item menggunakan stepper +/−, masukkan alasan (wajib), dan kirim. Ini membuat sebuah **faktur retur** yang sesungguhnya (nomor fakturnya sendiri, berawalan `RET-`) yang membalikkan pendapatan, diskon, dan pajak penjualan asli secara proporsional — ini bukan penyesuaian inventaris diam-diam, ini adalah transaksi tertaut nyata yang bisa Anda temukan nanti dari kedua faktur.

## Logistics & Supply Chain

Karena template default Retail mencakup modul Logistics, Anda juga mendapatkan **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, dan **Logistics Analytics** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing. Sebuah toko retail juga dapat mengaktifkan tambahan lintas-sektor secara independen dari **Settings → Additional Business Features** — pembuatan/pencetakan Barcode dan penagihan Loose/Weight adalah pilihan umum untuk sebuah toko retail, tetapi nonaktif secara default dan tidak khusus untuk jenis bisnis Retail.
