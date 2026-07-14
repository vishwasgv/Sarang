# Penagihan & Dokumen

## Membuat faktur

Buka **Penagihan** dari sidebar (`/billing`) untuk masuk ke layar point-of-sale. Di sinilah setiap faktur dimulai:

1. **Cari produk** di kotak sebelah kiri — berdasarkan nama, SKU, atau barcode. Memilih hasil pencarian (atau memindai barcode) akan menambahkannya ke keranjang. Jika produk memiliki varian (ukuran/warna) atau nomor seri yang dilacak (IMEI), sebuah picker akan muncul agar Anda memilih unit yang tepat sebelum ditambahkan.
2. **Sesuaikan jumlah dan diskon** pada setiap baris keranjang. Jumlah bertambah per unit utuh, atau per 0.1 untuk item yang dihargai per berat. Diskon bisa dimasukkan sebagai jumlah mata uang atau persentase — tombol toggle kecil di samping kolom diskon beralih di antara keduanya.
3. **Pilih pelanggan**, di sisi kanan. Ketik nama atau nomor telepon untuk mencari pelanggan yang sudah ada; jika baru, klik **+ Add Customer** untuk menambahkan cepat hanya nama dan telepon tanpa meninggalkan faktur. Membiarkan kolom pelanggan kosong akan menagih pelanggan umum (walk-in).
4. **Pilih metode pembayaran**: Tunai, UPI, Kartu, Wallet, Kredit (Bayar Nanti), atau Split. **Kredit** memerlukan pelanggan yang dipilih — faktur dibuat BELUM LUNAS dan jumlahnya ditambahkan ke buku besar pelanggan tersebut. **Split** memungkinkan Anda memasukkan jumlah Tunai dan UPI terpisah yang harus totalnya sama dengan total faktur.
5. **Terapkan diskon global** (selain diskon per-baris jika ada) bila diperlukan, menggunakan kotak diskon di panel ringkasan.
6. Jika model pajak Anda adalah GST, centang **Inter-State Sale (IGST)** ketika penjualan melintasi batas negara bagian — ini mengubah baris pajak yang tercetak dari CGST+SGST menjadi satu baris IGST.
7. Klik **Confirm Sale** (atau tekan **F10** / **Ctrl+Enter**) untuk membuat faktur. Anda akan langsung dibawa ke layar detail faktur baru tersebut.

Keranjang menampilkan subtotal berjalan, diskon, pajak, penyesuaian pembulatan, dan total saat Anda menyusunnya. **Clear Cart** di bagian bawah mengatur ulang semuanya tanpa menyimpan.

## Riwayat dan detail faktur

**Invoice List** (`/billing`, melalui tampilan daftar faktur) menampilkan setiap faktur beserta pelanggannya, jumlah item, total, saldo terutang, dan status pembayaran (BELUM LUNAS / SEBAGIAN / LUNAS / DIBATALKAN). Cari berdasarkan nomor faktur atau pelanggan, filter berdasarkan rentang tanggal atau status Aktif/Dibatalkan.

Membuka sebuah faktur menampilkan seluruh baris item, rincian pajak, dan riwayat pembayarannya. Dari sini Anda bisa:

- **Record Payment** — masukkan jumlah (penuh atau sebagian), pilih metode (Tunai, UPI, Kartu, atau Wallet — Kredit tidak ditawarkan di sini karena mencatat pembayaran berarti uang sungguhan telah diterima), dan nomor referensi serta keterangan opsional. Mencatat pembayaran langsung memperbarui saldo dan status pembayaran; mencatat kurang dari saldo penuh membuat faktur tetap berstatus SEBAGIAN.
- **Reverse Payment** — jika sebuah pembayaran tercatat keliru, batalkan (reverse) dengan menyertakan alasan. Pembayaran yang dibatalkan tetap terlihat (dengan garis coret) untuk keperluan jejak audit.
- **Print** atau **Print Receipt** — pratinjau tata letak faktur A4 atau struk thermal sebelum mengirimnya ke printer.
- **Cancel Invoice** — memerlukan alasan dan tidak dapat dibatalkan kembali.
- **Send to Kitchen** — hanya muncul untuk bisnis bertipe Restoran dengan KOT aktif, dan hanya sebelum sebuah KOT sudah ada untuk faktur tersebut.

**Payment History** adalah layar terpisah yang mendaftar setiap pembayaran yang pernah tercatat, di seluruh faktur — dapat dicari berdasarkan faktur, pelanggan, atau nomor referensi, dan difilter berdasarkan metode pembayaran atau rentang tanggal. Membatalkan (reverse) pembayaran juga bisa dilakukan dari sini.

## Quotations

**Quotations** (`/billing/quotations`) adalah perkiraan harga yang tidak mengikat, yang bisa Anda berikan kepada pelanggan sebelum mereka memutuskan. Buat satu dengan **New Quotation**: pilih atau ketik nama pelanggan, tambahkan baris item (dicari dengan cara yang sama seperti Penagihan), tanggal masa berlaku opsional, dan catatan.

Sebuah quotation dimulai sebagai **Draft** dan bisa menjadi **Sent**, **Accepted**, atau **Expired**. Setelah pelanggan menyetujuinya, klik **Convert to Invoice** — ini membuat faktur sungguhan dari item-item quotation tersebut dan menandai quotation sebagai Accepted. Quotation yang sudah dikonversi menampilkan tautan ke faktur hasilnya, bukan tombol konversi. Quotation bisa dicetak dalam lebar A4 atau struk, dan dihapus selama belum dikonversi.

## Credit Notes dan Debit Notes

**Credit Notes** (`/billing/credit-notes`) mencatat uang yang harus dikembalikan *kepada* pelanggan — biasanya untuk retur, kelebihan tagih, atau penyesuaian goodwill. Buat satu dengan alasan dan jumlah, opsional dikaitkan dengan pelanggan dan/atau faktur asli. Mengaitkannya dengan pelanggan otomatis mengkredit buku besar mereka, mengurangi jumlah yang mereka utang kepada Anda.

**Debit Notes** (`/billing/debit-notes`) adalah padanannya dari sisi pemasok — uang yang harus dikembalikan pemasok kepada Anda, misalnya retur stok yang dibeli atau koreksi tagihan. Mengaitkan debit note dengan pemasok mendebit buku besar mereka, mengurangi jumlah yang Anda utang kepada mereka. Baik credit note maupun debit note bisa opsional merujuk ke faktur atau pesanan pembelian yang terkait, bisa diedit atau dihapus, dan dicetak dalam lebar A4 atau struk.

## Catatan tentang pajak dan pembulatan

Setiap total faktur dibulatkan ke unit mata uang bulat terdekat, dengan selisih pembulatan ditampilkan sebagai barisnya sendiri sehingga perhitungannya selalu terlihat jelas. Pada model pajak GST, pajak dicetak sebagai CGST+SGST untuk penjualan dalam satu negara bagian atau satu baris IGST untuk penjualan antar-negara bagian, berdasarkan kotak centang yang diatur saat faktur dibuat.
