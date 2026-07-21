# Electronics

Memilih **Electronics** sebagai jenis bisnis Anda mengaktifkan **pelacakan nomor serial**, **pelacakan IMEI**, **pelacakan garansi**, dan set modul **Logistics** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah toko elektronik.

## Serial / Device Tracking

Buka **Serial Tracking** (berlabel "Device & Serial Tracking" untuk Electronics) dari sidebar untuk mencatat unit stok yang teridentifikasi unik satu per satu — bukan hanya "berapa banyak," tetapi unit persis yang mana. Tambahkan sebuah perangkat satu per satu dengan produk, nomor serial, panjang garansi dalam bulan, tanggal pembelian, dan biayanya, atau gunakan **Bulk Import** untuk menempelkan sekaligus seluruh batch nomor serial (satu per baris, dengan kolom IMEI jika relevan). Setiap perangkat memiliki status — **Available**, **Sold**, **Returned**, atau **Defective** — yang bisa Anda ubah kapan saja dari daftar.

Karena produk yang dilacak-serial mewakili satu unit fisik, menambahkannya ke keranjang di Billing mengunci kuantitasnya menjadi 1 — Anda tidak bisa "menjual 3" dari sebuah nomor serial tertentu, hanya bisa menjual satu unit itu sendiri.

## Pelacakan IMEI

Untuk ponsel dan perangkat lain yang membawa IMEI, setiap catatan perangkat juga bisa membawa dua nomor IMEI (dual-SIM). Kotak **IMEI Lookup** khusus pada layar Serial Tracking memungkinkan Anda langsung mencari sebuah perangkat berdasarkan IMEI dan melihat status serta garansinya sekilas — berguna untuk pencarian purnajual atau konter perbaikan.

## Pelacakan garansi

Garansi setiap perangkat disimpan sebagai panjang dalam bulan dari tanggal pembelian/mulai-garansinya, dan Sarang menghitung serta menampilkan tanggal kedaluwarsa sebenarnya tepat di sampingnya — ditampilkan sebagai masih berlaku atau jelas ditandai **Expired** setelah lewat. Ask Sarang (jika diaktifkan) juga bisa menjawab "Which items are still under warranty?" langsung dari data ini.

## Tiket Perbaikan / RMA

Sebuah perangkat yang sudah terjual dan dilacak-serial mendapatkan tombol **Repair** pada Serial Tracking — buka untuk melihat riwayat servis lengkap unit tersebut, atau mulai sebuah tiket perbaikan baru untuknya. Sebuah tiket membawa nomor klaim dan bergerak melalui **Received → Diagnosed → Sent to Vendor → Awaiting Parts → Repaired/Replaced → Returned to Customer** (atau Cancelled, hanya sebelum sebuah unit pengganti benar-benar dikirim keluar). Catat vendor mana yang Anda kirimi dan nomor RMA mereka sendiri jika perangkat dikirim untuk perbaikan garansi.

Jika perbaikannya adalah penggantian langsung, pilih **Replaced** dan pilih sebuah unit stok dari produk yang sama sebagai pengganti — Sarang menandai unit asli Defective, unit pengganti Sold (mewarisi faktur penjualan asli), dan menguranginya dari stok secara otomatis, sama seperti penjualan lainnya. Sebuah perbaikan hanya bisa dibuka terhadap unit yang benar-benar sudah terjual — sebuah perangkat berstok yang belum pernah terjual belum memiliki riwayat servis untuk dilacak.

## Logistics & Supply Chain

Karena template default Electronics mencakup modul Logistics, Anda juga mendapatkan **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, dan **Logistics Analytics** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing.
