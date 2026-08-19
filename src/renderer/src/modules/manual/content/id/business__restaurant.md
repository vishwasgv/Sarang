# Restaurant

Memilih **Restoran** sebagai jenis bisnis Anda saat setup mengaktifkan empat hal di luar fitur universal yang didapat setiap bisnis: **Meja**, **Tiket Pesanan Dapur (KOT)**, **Resep**, dan pelacakan stok bahan. Billing, Customers, Inventory, dan Reports semuanya bekerja dengan cara yang sama seperti dijelaskan di bab masing-masing — bab ini hanya membahas apa yang khusus untuk menjalankan sebuah restoran.

## Tables

Buka **Meja Restoran** dari sidebar untuk melihat setiap meja yang telah Anda konfigurasi, masing-masing ditampilkan sebagai kartu dengan status saat ini: **Kosong**, **Terisi**, atau **Psn** (Reserved). Tambahkan sebuah meja dengan nomor meja (misalnya "T1") dan nama tampilan opsional. Ketuk tombol status pada kartu sebuah meja untuk mengubahnya secara manual — atau biarkan status meja mengikuti pesanan sungguhan secara otomatis, lihat di bawah. Sebuah meja tidak dapat dihapus selama memiliki tiket dapur yang aktif. Tetapkan seorang **pelayan** ke sebuah meja dari kartunya sehingga Anda selalu tahu siapa yang melayaninya; hapus penugasan tersebut kapan saja.

**Mulai Pesanan** pada kartu meja kosong membuka Billing dengan meja itu sudah terpasang — susun keranjang seperti biasa dan konfirmasi penjualan. Meja sekarang benar-benar terhubung ke tagihan itu: kartunya menampilkan **Lihat Tagihan** (langsung ke invoice) dan **Gabungkan** menggantikan Start Order, dan meja otomatis bebas kembali ke Free begitu tagihan lunas sepenuhnya atau dibatalkan — tidak perlu mengingat untuk mengubah statusnya secara manual.

**Gabungkan** menggabungkan meja kedua ke tagihan yang sama yang sedang berjalan — untuk rombongan besar yang duduk di dua meja atau lebih dan ingin satu tagihan di akhir. Ketuk pada meja yang sudah menjalankan pesanan, pilih meja kosong mana pun dari daftar, dan meja itu sekarang menampilkan pasangan **Lihat Tagihan**/**Gabungkan** yang sama, mengarah ke invoice yang sama. Tambahkan sebanyak mungkin meja sesuai luas rombongan itu.

**Tutup Harian** adalah tombol pada layar ini: ia menandai setiap meja yang terisi menjadi tersedia kembali dan menampilkan ringkasan penutupan satu baris (KOT yang dilayani dan pendapatan hari ini) sehingga Anda dapat menutup ruang makan di akhir shift.

## Reservasi

Ketuk **Reservasi** di bagian atas Restaurant Tables untuk melihat pemesanan mendatang dan menambah yang baru — nama pelanggan, telepon, jumlah rombongan, tanggal/waktu, meja opsional, dan catatan bebas (kebutuhan makanan khusus, acara spesial, apa pun yang perlu diketahui saat mendudukkan mereka). Meja dengan reservasi yang akan datang dalam beberapa jam ke depan menampilkan lencana kecil "Reserved 7:30 PM" langsung di kartunya, jadi Anda bisa melihatnya sekilas di lantai.

Saat rombongan tiba, ketuk **Dudukkan** — ini menandai meja sebagai Busy dan reservasi sebagai Seated; reservasi itu sendiri tidak membuat tagihan, jadi gunakan **Mulai Pesanan** pada meja seperti biasa begitu mereka siap memesan. **Tidak Hadir** dan **Batal** menutup reservasi yang tidak terjadi, tanpa menyentuh meja.

## Memisah tagihan

Setelah pesanan tercatat tapi sebelum ada pembayaran, **Pisah Tagihan** pada layar invoice membaginya menjadi dua tagihan terpisah atau lebih — pilih berapa banyak tagihan, lalu tentukan berapa banyak dari setiap item masuk ke masing-masing tagihan (item yang dibagi bersama, seperti satu makanan penutup yang dibagi dua orang, bisa dipecah hingga per unit). Setiap tagihan menjadi invoice sungguhan sendiri, ditagih dan dibayar terpisah dari situ. Meja tetap Busy, sekarang mengarah ke tagihan pertama, hingga setiap tagihan yang terpisah benar-benar lunas. Memisah hanya mengubah cara tagihan dibayar — tiket dapur asli dan stok yang sudah dikurangi tidak tersentuh.

## Tip / biaya layanan dan item "86"

Pada layar Billing, gunakan **Tambah Tip / Biaya Layanan** untuk menambahkan baris tip ke sebuah bill tanpa itu terikat pada item menu tertentu atau dikenai pajak sebagai sebuah produk.

Pada layar Products, alihkan sebuah item menu mana pun menjadi **86** (istilah slang dapur untuk "stok habis untuk hari ini") untuk langsung menyembunyikannya dari keranjang billing dan menu QR yang menghadap pelanggan, tanpa menonaktifkan produk itu sendiri — cocok untuk sebuah hidangan yang habis terjual untuk hari itu tetapi akan kembali ke menu besok.

## Harga Combo / Thali

Buat combo atau thali sebagai item menu seperti produk lainnya, lalu buka untuk diedit dan gunakan **Manage Kit Components** untuk menambahkan masing-masing hidangan yang menyusunnya dan berapa banyak masing-masing. Tetapkan harga jual combo itu sendiri pada produknya — ini sepenuhnya independen dari berapa harga hidangan individual jika dijual terpisah, sehingga thali dapat diberi harga sebagai penawaran paket sungguhan, bukan jumlah dari bagian-bagiannya. Menjual combo menagihnya sebagai satu baris yang bersih, tetapi di baliknya mengurangi stok setiap hidangan yang dikandungnya dengan benar, dan menandai tiket dapurnya sebagai **Mark Done** juga mengurangi bahan-bahan di balik hidangan-hidangan tersebut dengan benar — sama seperti jika setiap hidangan dipesan secara terpisah.

## Harga Jam Bahagia

Untuk menjalankan jam bahagia — misalnya diskon 20% untuk minuman pukul 16.00–18.00 — tidak memerlukan fitur restoran khusus: buat Skema Harga **Jam Bahagia / Diskon % Flat** (Skema Harga, lihat bab Pesanan Penjualan & Penetapan Harga) yang dibatasi ke kategori minuman atau satu item, dan beri waktu mulai serta akhir harian bersama diskonnya. Ini berlaku otomatis saat checkout hanya selama jendela waktu tersebut dan mati dengan sendirinya begitu jendela waktu berakhir — tidak ada yang perlu mengingat untuk menyalakan atau mematikan diskon secara manual.

## Kitchen Order Tickets (KOT)

Sebuah KOT adalah salinan dapur dari sebuah pesanan. Setelah membuat pesanan di **Penagihan**, buka faktur tersebut dan ketuk **Kirim ke Dapur** untuk membuat KOT untuknya. Dari **Kitchen Order Tickets** di sidebar, staf dapur melihat setiap tiket dikelompokkan berdasarkan status — Pending, In Progress, Done, Cancelled — beserta item dan kuantitasnya, dan memajukan masing-masing dengan satu ketukan (**Start Cooking** → **Mark Done**), atau **Batal**. Setiap tiket juga bisa langsung dicetak ke printer dapur Anda.

Menandai sebuah KOT **Selesai** adalah yang memicu pengurangan stok bahan (lihat di bawah) dan membebaskan meja yang dimilikinya, begitu tidak ada tiket aktif lain yang menggunakan meja tersebut.

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

Buka **Resep** untuk menautkan sebuah item menu (misalnya "Masala Chai") ke bahan mentah yang dikonsumsinya dan berapa banyak masing-masing — cari produk menu, beri nama resep, lalu tambahkan baris bahan (setiap bahan hanya bisa muncul satu kali per resep; gabungkan kuantitas alih-alih menambahkan baris duplikat). Daftar bahan setiap resep ditampilkan terbuka dalam tampilan daftar.

Setelah sebuah resep ada untuk item menu, menyelesaikan KOT-nya (menandainya Done) secara otomatis mengurangi kuantitas bahan resep × kuantitas yang dipesan dari stok produk reguler Anda — tidak ada inventaris bahan terpisah untuk dikelola. Jika stok sebuah bahan tidak bisa disesuaikan karena alasan tertentu, Sarang tidak diam-diam kehilangan selisihnya: ia memunculkan notifikasi yang memberi tahu bahan mana yang perlu dihitung ulang secara manual, sehingga angka stok Anda tidak pernah diam-diam melenceng.

Item menu tanpa resep yang dikonfigurasi cukup tidak mengurangi stok bahan apa pun saat terjual — resep sepenuhnya opsional per item.

## Laporan

Buka **Laporan → Margin Kontribusi per Hidangan** untuk melihat, untuk setiap hidangan yang terjual dalam rentang tanggal, pendapatannya dikurangi biaya resepnya — grafik batang plus tabel lengkap, diurutkan sehingga hidangan dengan margin terbaik berada di atas. Ini adalah pertanyaan yang berbeda dari **Laporan → Laporan Biaya Makanan**: Biaya Makanan menjumlahkan apa yang benar-benar Anda keluarkan untuk bahan selama periode ini, sementara Margin Kontribusi menjawab "hidangan mana yang benar-benar menutupi biayanya", menggunakan rumus resep masing-masing hidangan alih-alih total pengeluaran. Margin combo atau thali secara benar mencerminkan resep hidangan asli di dalamnya, dan item menu tanpa resep yang dikonfigurasi cukup menampilkan biaya bahan 0 — "tidak ada data" yang jujur, bukan tebakan.

Buka **Laporan → Perputaran Meja per Jam** untuk melihat peta panas hari-dalam-minggu × jam-dalam-hari dari pesanan makan di tempat Anda dalam rentang tanggal — semakin gelap sebuah sel, semakin sibuk restoran Anda sesungguhnya selama jam tersebut, pada hari itu. Di sini hanya pesanan yang benar-benar dimulai dari meja (melalui **Start Order** di Restaurant Tables) yang dihitung; penjualan konter atau bawa pulang tanpa meja terkait bukan bagian dari pertanyaan "perputaran meja" dan dikecualikan dengan benar. Gunakan ini untuk melihat jam sibuk sebenarnya sekilas, bukan tebakan berdasarkan ingatan — berguna untuk menjadwalkan shift staf berdasarkan kapan lantai restoran sebenarnya paling sibuk.

Buka **Laporan → Varians Pemborosan: Resep vs. Aktual** untuk membandingkan, per bahan, berapa yang seharusnya digunakan menurut resep Anda dengan apa yang sebenarnya diambil dari stok dalam rentang tanggal — grafik batang plus tabel lengkap, dengan selisih terbesar di awal. Bahan yang secara konsisten lebih tinggi dari yang ditunjukkan resepnya adalah sinyal nyata yang layak diperiksa — porsi berlebih, tumpahan, atau resep yang sudah usang — sementara bahan yang lebih rendah bisa berarti sebaliknya. Ini benar-benar berbeda dari kedua laporan di atas: Biaya Makanan dan Margin Kontribusi masing-masing menunjukkan satu sisi cerita (pengeluaran aktual, atau biaya sesuai resep); ini adalah satu-satunya laporan yang menempatkan kedua sisi bahan yang SAMA berdampingan.

## Pemesanan meja lewat QR-code (opt-in)

Restaurant Tables juga memiliki toggle **Pemesanan Meja via QR**, nonaktif secara default. Aktifkan dan Sarang memulai server lokal kecil di jaringan WiFi Anda sendiri (tanpa perlu internet) sehingga pelanggan dapat memindai kode QR meja yang tercetak, menjelajahi menu, dan mengajukan permintaan pesanan dari ponsel mereka. Tidak ada yang otomatis menjadi tagihan sungguhan — setiap pesanan masuk muncul di bawah **Incoming Orders** pada layar Kitchen Order Tickets, tempat staf secara eksplisit **Terima** (memilih metode pembayaran, yang membuat faktur dan KOT bersamaan) atau **Tolak** pesanan tersebut. Kode QR setiap meja bisa dibuat dan dicetak dari kartunya pada layar Restaurant Tables.

### QR gabung WiFi (kombo dengan QR pemesanan)

Karena ponsel pelanggan perlu berada di WiFi restoran Anda agar bisa mencapai halaman pemesanan sama sekali, kartu **Jaringan WiFi** (muncul begitu Pemesanan Meja via QR aktif) memungkinkan Anda menyimpan nama dan kata sandi jaringan tamu Anda satu kali. Setelah itu, kode QR setiap meja menampilkan — dan mencetak — kode QR kedua di atas kode QR pemesanan: pindai untuk bergabung ke WiFi secara otomatis, lalu pindai kode QR pemesanan tepat di bawahnya untuk menjelajahi menu dan memesan. Tidak perlu mengetik kata sandi, tidak perlu papan WiFi terpisah di dekat meja.

Ini sepenuhnya opsional — biarkan kartu Jaringan WiFi tidak dikonfigurasi dan kode QR meja tetap bekerja persis seperti sebelumnya (hanya kode QR pemesanan). Mengedit jaringan di kemudian hari (misalnya setelah mengganti kata sandi router Anda) hanyalah menyimpan ulang yang sederhana; membiarkan kolom kata sandi kosong saat hanya memperbarui nama jaringan akan mempertahankan kata sandi yang ada, bukan menghapusnya. Menandai jaringan sebagai **terbuka** (tanpa kata sandi) akan melewati kolom kata sandi sepenuhnya — berguna jika WiFi tamu Anda tidak memiliki kata sandi sendiri.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing. Jika Anda juga mengaktifkan Logistics & Supply Chain di **Settings → Additional Business Features**, Anda juga mendapatkan Fleet, Carriers, Shipments, GRN, Delivery Challan, Freight Ledger, dan Logistics Analytics — tetapi ini tidak aktif secara default untuk sebuah restoran, karena kebanyakan restoran tidak menjalankan armada pengiriman sendiri atau menerima pengiriman formal dari pemasok.
