# Barcode & Penagihan Lepas/Berat

Pembuatan barcode, pencetakan label barcode, dan penagihan lepas/berbasis berat adalah fitur opsional untuk bisnis penjual-produk (retail, apotek, toko kelontong, dan sejenisnya). Ketiganya nonaktif secara default untuk setiap jenis bisnis — tidak ada yang berubah tentang cara Anda menagih sampai Anda mengaktifkannya.

## Mengaktifkannya

Buka **Settings → Barcode & Loose Billing** dan aktifkan fitur yang Anda butuhkan, secara independen satu sama lain:

- **Barcode Generation & Scanning** — otomatis membuat barcode untuk produk dan mengaktifkan pemindaian barcode saat checkout dan pencarian stok.
- **Barcode Label Printing** — memungkinkan Anda mencetak label barcode + harga, baik pada printer label thermal maupun printer A4/letter biasa.
- **Loose / Weight-Based Billing** — memungkinkan Anda menjual sebuah produk berdasarkan berat (misalnya per kg) alih-alih, atau bersamaan dengan, harga paket tetap.

Menonaktifkan salah satu dari ini nanti tidak memengaruhi barcode yang sudah ada atau produk yang sudah diatur dijual lepas.

## Mengatur sebuah produk untuk dijual berdasarkan berat

Dalam formulir edit produk (**Produk**), centang **Sell by Weight**, lalu pilih satuan (kg, g, L, atau mL) dan tetapkan **Price per Unit** (misalnya ₹80 per kg). Sebuah produk dijual dalam paket tetap pada harga jual normalnya, atau dijual lepas berdasarkan berat pada harga per-satuan ini — tidak keduanya sekaligus.

## Membuat barcode

Dengan Barcode Generation aktif, mengedit produk yang sudah ada tanpa barcode menampilkan tombol **Generate** di samping kolom Barcode — klik untuk langsung menetapkan satu. Produk baru mendapatkan barcode secara otomatis saat disimpan jika Anda tidak mengetiknya sendiri. Barcode yang dibuat secara internal adalah kode EAN-13 13-digit standar yang dapat dibaca oleh pemindai biasa mana pun, menggunakan rentang nomor yang dicadangkan yang tidak pernah digunakan oleh barcode pabrikan asli, sehingga tidak akan pernah bertabrakan dengan kode produk yang dipindai.

Jika Anda mengaktifkan barcode setelah sudah memiliki produk dalam sistem, buka **Settings → Barcode & Loose Billing → Generate Missing Barcodes** untuk menetapkan barcode ke setiap produk yang belum memilikinya dalam satu klik — aman dijalankan lebih dari sekali, karena tidak pernah menyentuh produk yang sudah memiliki barcode.

## Mencetak label

Buka **Print Labels** (dapat diakses setelah Barcode Label Printing aktif). Cari atau pindai sebuah produk untuk menambahkannya ke batch label, tetapkan berapa banyak salinan setiap label yang Anda butuhkan (hingga 500 per baris), pilih **A4 / Letter Sheet** atau **Thermal Label Printer** sebagai keluaran, lalu **Preview** atau **Print** langsung. Jika ada produk dalam batch yang belum memiliki barcode, Sarang memberi tahu Anda yang mana dan berhenti — buat barcode untuk mereka terlebih dahulu (dari layar Produk atau backfill massal di atas).

Ukuran fisik label thermal (lebar dan tinggi dalam milimeter) dikonfigurasi sekali di bawah **Settings → Barcode & Loose Billing → Thermal Label Size** agar sesuai dengan stiker printer Anda; ini tidak memengaruhi pencetakan A4/sheet.

## Menimbang dan mencetak item lepas

Pada layar **Print Labels** yang sama, di bawah **Weigh & Print a Loose Item**: cari produk yang ditagih-lepas, timbang di timbangan mana pun, masukkan beratnya dalam gram, dan klik **Print Label**. Sarang menghitung harga untuk berat persis tersebut dan mencetak label satu-kali dengan barcode khusus yang menyandikan baik produk maupun jumlah yang ditimbang. Memindai label tersebut saat checkout menambahkannya ke tagihan dalam satu pindaian, sudah dihargai dengan benar — tidak perlu entri berat manual di kasir.

Jika Anda mencetak ulang label untuk produk yang sama pada berat yang persis sama setelah harganya berubah, Sarang memperingatkan Anda di layar sehingga Anda bisa mencari dan melepas stiker lama — label fisik lama yang dipindai kemudian akan mengenakan harga usang tanpa cara untuk membedakannya dari yang baru.

## Menjual item lepas di konter

Di **Penagihan**, Anda bisa memindai label berat yang sudah dicetak (langsung ditambahkan ke keranjang pada harga dan berat yang tercetak) atau mencari produk yang ditagih-lepas berdasarkan nama dan menambahkannya secara manual — ditambahkan pada kuantitas awal 1 dari satuannya yang dikonfigurasi, yang kemudian Anda sesuaikan ke jumlah timbangan sebenarnya sebelum checkout. Jika harga tercetak pada sebuah label yang dipindai tidak lagi sesuai dengan harga produk saat ini, Sarang tetap mengenakan apa yang tercetak pada label (karena itulah yang dilihat pelanggan) tetapi menampilkan peringatan agar Anda tahu untuk mencetak ulang label yang tersisa dengan harga baru.

Memindai label fisik yang persis sama dua kali pada satu tagihan ditandai dengan peringatan (untuk berjaga-jaga jika itu pemindaian ganda yang tidak sengaja), meskipun tetap ditambahkan — benar-benar menjual dua paket dengan berat yang identik dari item yang sama adalah skenario nyata yang diizinkan sistem.
