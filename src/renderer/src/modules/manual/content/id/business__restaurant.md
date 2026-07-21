# Restaurant

Memilih **Restaurant** sebagai jenis bisnis Anda saat setup mengaktifkan empat hal di luar fitur universal yang didapat setiap bisnis: **Tables**, **Kitchen Order Tickets (KOT)**, **Recipes**, dan pelacakan stok bahan. Billing, Customers, Inventory, dan Reports semuanya bekerja dengan cara yang sama seperti dijelaskan di bab masing-masing — bab ini hanya membahas apa yang khusus untuk menjalankan sebuah restoran.

## Tables

Buka **Restaurant Tables** dari sidebar untuk melihat setiap meja yang telah Anda konfigurasi, masing-masing ditampilkan sebagai kartu dengan status saat ini: **Free**, **Busy**, atau **Rsv** (Reserved). Tambahkan sebuah meja dengan nomor meja (misalnya "T1") dan nama tampilan opsional. Ketuk tombol status pada kartu sebuah meja untuk mengubahnya — sebuah meja tidak dapat dihapus selama memiliki tiket dapur yang aktif. Tetapkan seorang **pelayan** ke sebuah meja dari kartunya sehingga Anda selalu tahu siapa yang melayaninya; hapus penugasan tersebut kapan saja.

**End of Day** adalah tombol pada layar ini: ia menandai setiap meja yang terisi menjadi tersedia kembali dan menampilkan ringkasan penutupan satu baris (KOT yang dilayani dan pendapatan hari ini) sehingga Anda dapat menutup ruang makan di akhir shift.

## Tip / biaya layanan dan item "86"

Pada layar Billing, gunakan **Add Tip / Service Charge** untuk menambahkan baris tip ke sebuah bill tanpa itu terikat pada item menu tertentu atau dikenai pajak sebagai sebuah produk.

Pada layar Products, alihkan sebuah item menu mana pun menjadi **86** (istilah slang dapur untuk "stok habis untuk hari ini") untuk langsung menyembunyikannya dari keranjang billing dan menu QR yang menghadap pelanggan, tanpa menonaktifkan produk itu sendiri — cocok untuk sebuah hidangan yang habis terjual untuk hari itu tetapi akan kembali ke menu besok.

## Kitchen Order Tickets (KOT)

Sebuah KOT adalah salinan dapur dari sebuah pesanan. Setelah membuat pesanan di **Billing**, buka faktur tersebut dan ketuk **Send to Kitchen** untuk membuat KOT untuknya. Dari **Kitchen Order Tickets** di sidebar, staf dapur melihat setiap tiket dikelompokkan berdasarkan status — Pending, In Progress, Done, Cancelled — beserta item dan kuantitasnya, dan memajukan masing-masing dengan satu ketukan (**Start Cooking** → **Mark Done**), atau **Cancel**. Setiap tiket juga bisa langsung dicetak ke printer dapur Anda.

Menandai sebuah KOT **Done** adalah yang memicu pengurangan stok bahan (lihat di bawah) dan membebaskan meja yang dimilikinya, begitu tidak ada tiket aktif lain yang menggunakan meja tersebut.

## Opsi perangkat keras dapur

Selain layar Kitchen Order Tickets di dalam aplikasi, Sarang menawarkan tiga cara untuk menampilkan tiket ke staf dapur — ketiganya bisa berjalan sekaligus (mencetak tiket kertas, menampilkan di monitor dinding, dan membiarkan ponsel atau tablet mengendalikannya tidak saling meniadakan). Atur ini dari **Settings → Appearance**, khusus bisnis restoran.

**Kitchen Printer.** Secara default, mencetak KOT akan menuju printer default Windows Anda. Jika printer dapur Anda adalah perangkat fisik yang berbeda dari printer struk di meja kasir, pilih dari dropdown **Kitchen Printer** — sejak saat itu setiap pekerjaan cetak KOT langsung menuju ke sana, tanpa dialog cetak, tanpa pemilihan manual. Biarkan pada "Use Windows default printer" jika Anda hanya punya satu printer.

**Kitchen Display — second monitor.** Mengubah monitor kedua mana pun yang tersambung ke PC kasir menjadi papan KOT langsung berteks besar (Pending / In Progress / Recently Done), dioperasikan dengan mouse biasa — tidak perlu layar sentuh. Di bawah **Kitchen Display — second monitor**, pilih display yang terdeteksi dan ketuk **Open Kitchen Display**; layar tersebut akan terbuka penuh di sana dan menyegarkan diri secara otomatis. Beberapa catatan pemasangan fisik:
- Mouse hanya perlu menjangkau PC, bukan layarnya — jika dapur lebih dari beberapa meter dari PC kasir, gunakan **mouse nirkabel** (penerima USB-nya dicolokkan ke PC kasir) alih-alih mouse berkabel, karena kabel mouse berkabel tidak akan sampai.
- Kabel video monitor punya masalah jarak yang sama, biasanya lebih parah — kabel HDMI biasa mulai kehilangan sinyal setelah sekitar 10-15 meter. Jika dapur Anda berada di ruangan terpisah atau di seberang restoran (katakanlah 10-30m, mungkin melewati dinding), gunakan **kit extender HDMI-over-Ethernet** (sepasang pengirim/penerima murah yang tersambung dengan kabel jaringan biasa) alih-alih satu kabel HDMI panjang.
- Di pengaturan Windows Display, pastikan monitor kedua diatur ke **Extend these displays**, bukan Duplicate — itulah yang memungkinkan satu kursor mouse Anda berpindah ke sana.
- Jika memasang kabel sejauh itu ternyata tidak praktis, gunakan opsi ponsel/tablet/laptop di bawah ini — tidak perlu pengkabelan sama sekali.

**Kitchen Display — phone / laptop.** Memungkinkan ponsel, tablet, atau laptop mana pun yang tersambung ke WiFi toko Anda membuka papan KOT langsung di browsernya sendiri — tanpa perlu instal aplikasi, tablet yang diletakkan di dapur bekerja persis sama seperti ponsel atau laptop di sini. Aktifkan di bawah **Kitchen Display — phone / laptop**, lalu bacakan alamat LAN yang ditampilkan atau ketuk **Show QR code** dan minta perangkat memindainya. Ini bekerja sepenuhnya lewat WiFi Anda sendiri, tanpa perlu internet, dan sepenuhnya terpisah dari fitur pemesanan meja QR yang menghadap pelanggan di bawah (server berbeda, port berbeda, dan kode akses acak yang hanya pernah ditampilkan di sini di Settings — pelanggan yang memindai kode QR pemesanan mejanya sendiri tidak punya cara untuk mencapai papan dapur). Jika akses perlu dicabut sewaktu-waktu (misalnya ponsel dengan tautan itu hilang), ketuk **Regenerate access code** — setiap tautan/kode QR yang pernah dibagikan langsung berhenti berfungsi.

## Recipes dan pelacakan bahan

Buka **Recipes** untuk menautkan sebuah item menu (misalnya "Masala Chai") ke bahan mentah yang dikonsumsinya dan berapa banyak masing-masing — cari produk menu, beri nama resep, lalu tambahkan baris bahan (setiap bahan hanya bisa muncul satu kali per resep; gabungkan kuantitas alih-alih menambahkan baris duplikat). Daftar bahan setiap resep ditampilkan terbuka dalam tampilan daftar.

Setelah sebuah resep ada untuk item menu, menyelesaikan KOT-nya (menandainya Done) secara otomatis mengurangi kuantitas bahan resep × kuantitas yang dipesan dari stok produk reguler Anda — tidak ada inventaris bahan terpisah untuk dikelola. Jika stok sebuah bahan tidak bisa disesuaikan karena alasan tertentu, Sarang tidak diam-diam kehilangan selisihnya: ia memunculkan notifikasi yang memberi tahu bahan mana yang perlu dihitung ulang secara manual, sehingga angka stok Anda tidak pernah diam-diam melenceng.

Item menu tanpa resep yang dikonfigurasi cukup tidak mengurangi stok bahan apa pun saat terjual — resep sepenuhnya opsional per item.

## Pemesanan meja lewat QR-code (opt-in)

Restaurant Tables juga memiliki toggle **QR Table Ordering**, nonaktif secara default. Aktifkan dan Sarang memulai server lokal kecil di jaringan WiFi Anda sendiri (tanpa perlu internet) sehingga pelanggan dapat memindai kode QR meja yang tercetak, menjelajahi menu, dan mengajukan permintaan pesanan dari ponsel mereka. Tidak ada yang otomatis menjadi tagihan sungguhan — setiap pesanan masuk muncul di bawah **Incoming Orders** pada layar Kitchen Order Tickets, tempat staf secara eksplisit **Accept** (memilih metode pembayaran, yang membuat faktur dan KOT bersamaan) atau **Reject** pesanan tersebut. Kode QR setiap meja bisa dibuat dan dicetak dari kartunya pada layar Restaurant Tables.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing. Jika Anda juga mengaktifkan Logistics & Supply Chain di **Settings → Additional Business Features**, Anda juga mendapatkan Fleet, Carriers, Shipments, GRN, Delivery Challan, Freight Ledger, dan Logistics Analytics — tetapi ini tidak aktif secara default untuk sebuah restoran, karena kebanyakan restoran tidak menjalankan armada pengiriman sendiri atau menerima pengiriman formal dari pemasok.
