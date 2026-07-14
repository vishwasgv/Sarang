# Restaurant

Memilih **Restaurant** sebagai jenis bisnis Anda saat setup mengaktifkan empat hal di luar fitur universal yang didapat setiap bisnis: **Tables**, **Kitchen Order Tickets (KOT)**, **Recipes**, dan pelacakan stok bahan. Billing, Customers, Inventory, dan Reports semuanya bekerja dengan cara yang sama seperti dijelaskan di bab masing-masing — bab ini hanya membahas apa yang khusus untuk menjalankan sebuah restoran.

## Tables

Buka **Restaurant Tables** dari sidebar untuk melihat setiap meja yang telah Anda konfigurasi, masing-masing ditampilkan sebagai kartu dengan status saat ini: **Free**, **Busy**, atau **Rsv** (Reserved). Tambahkan sebuah meja dengan nomor meja (misalnya "T1") dan nama tampilan opsional. Ketuk tombol status pada kartu sebuah meja untuk mengubahnya — sebuah meja tidak dapat dihapus selama memiliki tiket dapur yang aktif.

**End of Day** adalah tombol pada layar ini: ia menandai setiap meja yang terisi menjadi tersedia kembali dan menampilkan ringkasan penutupan satu baris (KOT yang dilayani dan pendapatan hari ini) sehingga Anda dapat menutup ruang makan di akhir shift.

## Kitchen Order Tickets (KOT)

Sebuah KOT adalah salinan dapur dari sebuah pesanan. Setelah membuat pesanan di **Billing**, buka faktur tersebut dan ketuk **Send to Kitchen** untuk membuat KOT untuknya. Dari **Kitchen Order Tickets** di sidebar, staf dapur melihat setiap tiket dikelompokkan berdasarkan status — Pending, In Progress, Done, Cancelled — beserta item dan kuantitasnya, dan memajukan masing-masing dengan satu ketukan (**Start Cooking** → **Mark Done**), atau **Cancel**. Setiap tiket juga bisa langsung dicetak ke printer dapur Anda.

Menandai sebuah KOT **Done** adalah yang memicu pengurangan stok bahan (lihat di bawah) dan membebaskan meja yang dimilikinya, begitu tidak ada tiket aktif lain yang menggunakan meja tersebut.

## Recipes dan pelacakan bahan

Buka **Recipes** untuk menautkan sebuah item menu (misalnya "Masala Chai") ke bahan mentah yang dikonsumsinya dan berapa banyak masing-masing — cari produk menu, beri nama resep, lalu tambahkan baris bahan (setiap bahan hanya bisa muncul satu kali per resep; gabungkan kuantitas alih-alih menambahkan baris duplikat). Daftar bahan setiap resep ditampilkan terbuka dalam tampilan daftar.

Setelah sebuah resep ada untuk item menu, menyelesaikan KOT-nya (menandainya Done) secara otomatis mengurangi kuantitas bahan resep × kuantitas yang dipesan dari stok produk reguler Anda — tidak ada inventaris bahan terpisah untuk dikelola. Jika stok sebuah bahan tidak bisa disesuaikan karena alasan tertentu, Sarang tidak diam-diam kehilangan selisihnya: ia memunculkan notifikasi yang memberi tahu bahan mana yang perlu dihitung ulang secara manual, sehingga angka stok Anda tidak pernah diam-diam melenceng.

Item menu tanpa resep yang dikonfigurasi cukup tidak mengurangi stok bahan apa pun saat terjual — resep sepenuhnya opsional per item.

## Pemesanan meja lewat QR-code (opt-in)

Restaurant Tables juga memiliki toggle **QR Table Ordering**, nonaktif secara default. Aktifkan dan Sarang memulai server lokal kecil di jaringan WiFi Anda sendiri (tanpa perlu internet) sehingga pelanggan dapat memindai kode QR meja yang tercetak, menjelajahi menu, dan mengajukan permintaan pesanan dari ponsel mereka. Tidak ada yang otomatis menjadi tagihan sungguhan — setiap pesanan masuk muncul di bawah **Incoming Orders** pada layar Kitchen Order Tickets, tempat staf secara eksplisit **Accept** (memilih metode pembayaran, yang membuat faktur dan KOT bersamaan) atau **Reject** pesanan tersebut. Kode QR setiap meja bisa dibuat dan dicetak dari kartunya pada layar Restaurant Tables.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing. Jika Anda juga mengaktifkan Logistics & Supply Chain di **Settings → Additional Business Features**, Anda juga mendapatkan Fleet, Carriers, Shipments, GRN, Delivery Challan, Freight Ledger, dan Logistics Analytics — tetapi ini tidak aktif secara default untuk sebuah restoran, karena kebanyakan restoran tidak menjalankan armada pengiriman sendiri atau menerima pengiriman formal dari pemasok.
