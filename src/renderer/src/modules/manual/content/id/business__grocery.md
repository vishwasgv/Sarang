# Sembako / Toko Kirana

## Apa yang berbeda pada jenis usaha ini

Toko Sembako/Kirana menjual volume tinggi barang berumur simpan pendek (pelacakan batch/kedaluwarsa aktif secara default), memberikan kredit berjalan "khata" kepada pelanggan tetap, dan sering menjual bahan pokok seperti biji-bijian, kacang-kacangan, dan minyak curah berdasarkan berat alih-alih dikemas sebelumnya. Sembako menggabungkan pelacakan batch/kedaluwarsa dari Apotek dengan modul batas kredit dan analitik piutang dari Distributor — kombinasi yang telah terbukti, bukan hal baru.

## Pengingat Otomatis Khata (Kredit)

Buka laporan **Outstanding** — pelanggan mana pun dengan saldo khata yang telah jatuh tempo mendapatkan laporan **Tingkat Risiko Khata** sendiri (lihat di bawah) dengan tombol **Send Reminder** sekali ketuk di samping namanya. Menekannya membuka WhatsApp dengan pesan yang sudah terisi menyatakan saldo tertunggak mereka, dan mencatat kapan pengingat dikirim sehingga pelanggan yang sama tidak diingatkan lagi setidaknya selama 7 hari. Seperti setiap berbagi WhatsApp di Sarang, aplikasi menyerahkan ke WhatsApp dan tidak dapat memastikan pesan benar-benar terkirim — Anda yang harus menekan kirim.

## Penagihan Curah (Berdasarkan Berat)

Penagihan curah bukan eksklusif untuk Sembako — ini adalah sakelar per-produk yang tersedia untuk jenis usaha apa pun (lihat **Produk → Jual berdasarkan Berat**). Untuk toko Kirana, begitulah biasanya biji-bijian, kacang-kacangan, dan minyak diberi harga: tetapkan harga per kilogram/liter pada produk, dan layar penagihan menagih berdasarkan berat yang dimasukkan di kasir alih-alih harga tetap per unit.

## Laporan

Selain laporan standar Penjualan, Inventaris, dan Keuangan, Sembako mendapatkan:

- **Kepatuhan MRP** — setiap baris penjualan lampau di mana harga satuan melebihi MRP tercetak produk, dengan kelebihannya dikumpulkan — pemeriksaan kepatuhan sesungguhnya, bukan sekadar nomor referensi.
- **Pemborosan Barang Mudah Rusak** — stok yang dihapusbukukan karena kedaluwarsa (gunakan alasan **Kedaluwarsa** saat menyesuaikan stok untuk barang kedaluwarsa), per produk dan nilai.
- **Peringatan Penambahan Stok Harian** — produk cepat laku yang stoknya menipis, diperingkat berdasarkan berapa hari stok tersisa pada kecepatan penjualan saat ini.
- **Bauran Penjualan Curah vs. Kemasan** — berapa banyak pendapatan Anda berasal dari barang curah (ditagih berdasarkan berat) dibandingkan SKU yang dikemas sebelumnya.
- **Tingkat Risiko Khata** — setiap pelanggan kredit diperingkat berdasarkan risiko, menggabungkan seberapa lama utang tertuanya telah jatuh tempo dengan apakah saldonya naik atau turun selama 30 hari terakhir — menandai pelanggan tetap yang bergeser menuju piutang tak tertagih sebelum benar-benar gagal bayar, bukan sekadar daftar saldo statis.

## Bahasa

Sembako bukan salah satu templat bisnis layanan Sarang — ini adalah jenis bisnis kategori produk, jadi **tidak** terkunci bahasa. Antarmuka inti tersedia dalam 13 bahasa yang didukung.
