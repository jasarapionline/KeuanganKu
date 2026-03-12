/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PlusCircle, 
  Search, 
  RefreshCw, 
  Settings,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CreditCard,
  ExternalLink,
  ChevronRight,
  LayoutDashboard,
  History,
  CreditCard as AccountIcon,
  Trash2,
  Edit3,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Palette,
  LogOut
} from 'lucide-react';
import { format, parseISO, getYear, getMonth, isToday, isSameDay, isWithinInterval, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, subMonths } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safe date parsing helper
const safeParseDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const date = parseISO(dateStr);
  return isNaN(date.getTime()) ? new Date() : date;
};

interface Transaction {
  id: string;
  tanggal: string;
  jenis: 'Pemasukan' | 'Pengeluaran';
  rekening: string;
  nominal: number;
  keterangan: string;
}

interface Account {
  nama: string;
  warna: string;
}

const DEFAULT_COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'riwayat' | 'rekening' | 'settings'>('dashboard');
  const [appName, setAppName] = useState(localStorage.getItem('app_name') || 'KeuanganKu');
  const [themeColor, setThemeColor] = useState(localStorage.getItem('theme_color') || '#10b981');
  const [gasUrl, setGasUrl] = useState<string>(localStorage.getItem('gas_url') || '');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('gas_url'));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    jenis: 'Pengeluaran' as 'Pemasukan' | 'Pengeluaran',
    rekening: '',
    nominal: '',
    keterangan: ''
  });
  const [newAccount, setNewAccount] = useState({ nama: '', warna: DEFAULT_COLORS[0] });

  // Filters
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterAccount, setFilterAccount] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('2026-01-11');
  const [endDate, setEndDate] = useState<string>('2026-03-11');
  const [chartFilter, setChartFilter] = useState<'hari' | 'minggu' | 'bulan' | 'semua'>('minggu');
  const [showPdfSettings, setShowPdfSettings] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfSettings, setPdfSettings] = useState(() => {
    const saved = localStorage.getItem('pdf_settings');
    return saved ? JSON.parse(saved) : {
      bankName: 'BRI',
      slogan: 'Melayani Dengan Setulus Hati',
      customerName: 'MUHAMMAD IDRIS',
      address1: 'DUKUH RT 03 RW 04',
      address2: 'SRAGEN, JAWA TENGAH',
      accountNo: '747201009920538',
      productName: 'SIMPEDES UMUM',
      currency: 'IDR'
    };
  });

  const fetchData = async () => {
    if (!gasUrl) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(gasUrl);
      if (!response.ok) throw new Error('Gagal mengambil data');
      const result = await response.json();
      
      setTransactions(result.transactions.map((t: any) => ({ ...t, nominal: Number(t.nominal) })));
      setAccounts(result.accounts);
      if (result.accounts.length > 0 && !newTransaction.rekening) {
        setNewTransaction(prev => ({ ...prev, rekening: result.accounts[0].nama }));
      }
      localStorage.setItem('gas_url', gasUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Gagal logout.');
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = safeParseDate(t.tanggal);
      const yearMatch = filterYear === 'All' || getYear(date).toString() === filterYear;
      const monthMatch = filterMonth === 'All' || (getMonth(date) + 1).toString() === filterMonth;
      const typeMatch = filterType === 'All' || t.jenis === filterType;
      const accountMatch = filterAccount === 'All' || t.rekening === filterAccount;
      
      const start = startDate ? safeParseDate(startDate).getTime() : 0;
      const end = endDate ? safeParseDate(endDate).getTime() + 86399999 : Infinity; // End of day
      const dateMatch = date.getTime() >= start && date.getTime() <= end;

      return yearMatch && monthMatch && typeMatch && accountMatch && dateMatch;
    }).sort((a, b) => safeParseDate(b.tanggal).getTime() - safeParseDate(a.tanggal).getTime());
  }, [transactions, filterYear, filterMonth, filterType, filterAccount, startDate, endDate]);

  const years = useMemo(() => {
    const yrs = new Set(transactions.map(t => getYear(safeParseDate(t.tanggal)).toString()));
    return ['All', ...Array.from(yrs).sort().reverse()];
  }, [transactions]);

  const accountBalances = useMemo(() => {
    return accounts.map(acc => {
      const balance = transactions
        .filter(t => t.rekening === acc.nama)
        .reduce((sum, t) => t.jenis === 'Pemasukan' ? sum + t.nominal : sum - t.nominal, 0);
      return { ...acc, balance };
    });
  }, [transactions, accounts]);

  const totalBalance = useMemo(() => {
    return accountBalances.reduce((sum, acc) => sum + acc.balance, 0);
  }, [accountBalances]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.jenis === 'Pemasukan').reduce((s, t) => s + t.nominal, 0);
    const expense = transactions.filter(t => t.jenis === 'Pengeluaran').reduce((s, t) => s + t.nominal, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('pdf_settings', JSON.stringify(pdfSettings));
  }, [pdfSettings]);

  useEffect(() => {
    localStorage.setItem('theme_color', themeColor);
    document.documentElement.style.setProperty('--primary-color', themeColor);
    // Generate a lighter version for backgrounds
    const r = parseInt(themeColor.slice(1, 3), 16);
    const g = parseInt(themeColor.slice(3, 5), 16);
    const b = parseInt(themeColor.slice(5, 7), 16);
    document.documentElement.style.setProperty('--primary-color-light', `rgba(${r}, ${g}, ${b}, 0.1)`);
  }, [themeColor]);

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Login />;

  // Form States



  const handlePost = async (payload: any) => {
    if (!gasUrl) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
      
      setSuccess('Berhasil memperbarui data!');
      setTimeout(() => setSuccess(null), 3000);
      fetchData();
      setEditingTransaction(null);
      setEditingAccount(null);
    } catch (err) {
      setError('Gagal mengirim data. Pastikan URL Apps Script benar.');
    } finally {
      setSubmitting(false);
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // BRI Style Header
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, 'F');
      
      // Logo Placeholder (Blue stylized BRI)
      doc.setTextColor(0, 82, 159);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(32);
      doc.text(pdfSettings.bankName, 14, 25);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(pdfSettings.slogan, 14, 32);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("LAPORAN TRANSAKSI FINANSIAL", 196, 20, { align: 'right' });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("STATEMENT OF FINANCIAL TRANSACTION", 196, 24, { align: 'right' });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Halaman 1 dari 1`, 196, 30, { align: 'right' });
      doc.text(`Page 1 of 1`, 196, 33, { align: 'right' });

      // Customer Info Box
      doc.setDrawColor(200, 200, 200);
      doc.rect(14, 45, 80, 45);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Kepada Yth. / To :", 16, 52);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(pdfSettings.customerName, 16, 62);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(pdfSettings.address1, 16, 70);
      doc.text(pdfSettings.address2, 16, 74);

      // Account Info
      const infoX = 110;
      doc.setFontSize(8);
      doc.text("Tanggal Laporan", infoX, 52);
      doc.text("Statement Date", infoX, 55);
      doc.text(":", infoX + 30, 53);
      doc.text(format(new Date(), 'dd/MM/yy'), infoX + 35, 53);

      doc.text("Periode Transaksi", infoX, 62);
      doc.text("Transaction Periode", infoX, 65);
      doc.text(":", infoX + 30, 63);
      doc.text(`${format(safeParseDate(startDate), 'dd/MM/yy')} - ${format(safeParseDate(endDate), 'dd/MM/yy')}`, infoX + 35, 63);

      doc.text("No. Rekening", 14, 100);
      doc.text("Account No", 14, 103);
      doc.text(":", 45, 101);
      doc.text(pdfSettings.accountNo, 50, 101);

      doc.text("Nama Produk", 14, 110);
      doc.text("Product Name", 14, 113);
      doc.text(":", 45, 111);
      doc.text(pdfSettings.productName, 50, 111);

      doc.text("Valuta", 14, 120);
      doc.text("Currency", 14, 123);
      doc.text(":", 45, 121);
      doc.text(pdfSettings.currency, 50, 121);

      // Calculate Saldo Awal (Balance before startDate)
      const saldoAwal = transactions
        .filter(t => safeParseDate(t.tanggal).getTime() < safeParseDate(startDate).getTime())
        .reduce((sum, t) => t.jenis === 'Pemasukan' ? sum + t.nominal : sum - t.nominal, 0);

      let currentSaldo = saldoAwal;
      
      // Sort transactions by date ASC for balance calculation
      const sortedForPDF = [...filteredTransactions].sort((a, b) => safeParseDate(a.tanggal).getTime() - safeParseDate(b.tanggal).getTime());

      const tableData = sortedForPDF.map(t => {
        const debet = t.jenis === 'Pengeluaran' ? t.nominal : 0;
        const kredit = t.jenis === 'Pemasukan' ? t.nominal : 0;
        currentSaldo += (kredit - debet);
        
        return [
          format(safeParseDate(t.tanggal), 'dd/MM/yy HH:mm:ss'),
          t.keterangan || (t.jenis === 'Pemasukan' ? 'Transfer Masuk' : 'Transfer Keluar'),
          '8888296', // Dummy Teller ID
          debet > 0 ? debet.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00',
          kredit > 0 ? kredit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00',
          currentSaldo.toLocaleString('en-US', { minimumFractionDigits: 2 })
        ];
      });

      autoTable(doc, {
        head: [['Tanggal Transaksi', 'Uraian Transaksi', 'Teller', 'Debet', 'Kredit', 'Saldo']],
        body: tableData,
        startY: 135,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [173, 216, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        }
      });

      doc.save(`E-Statement_BRI_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (err) {
      console.error('Export PDF error:', err);
      setError('Gagal mengekspor PDF. Pastikan library jspdf-autotable terpasang.');
    }
  };

  const months = [
    { val: 'All', label: 'Semua Bulan' },
    { val: '1', label: 'Januari' }, { val: '2', label: 'Februari' },
    { val: '3', label: 'Maret' }, { val: '4', label: 'April' },
    { val: '5', label: 'Mei' }, { val: '6', label: 'Juni' },
    { val: '7', label: 'Juli' }, { val: '8', label: 'Agustus' },
    { val: '9', label: 'September' }, { val: '10', label: 'Oktober' },
    { val: '11', label: 'November' }, { val: '12', label: 'Desember' }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
              style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}33` }}
            >
              <Wallet size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">{appName}</h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={18} />} label="Dashboard" themeColor={themeColor} />
            <TabButton active={activeTab === 'riwayat'} onClick={() => setActiveTab('riwayat')} icon={<History size={18} />} label="Riwayat" themeColor={themeColor} />
            <TabButton active={activeTab === 'rekening'} onClick={() => setActiveTab('rekening')} icon={<AccountIcon size={18} />} label="Rekening" themeColor={themeColor} />
            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={18} />} label="Pengaturan" themeColor={themeColor} />
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={fetchData} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw size={20} className={cn(loading && "animate-spin")} />
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings size={20} />
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {showSettings && (
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Konfigurasi Apps Script</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <input 
              type="text" 
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="URL Web App Apps Script..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
            <button onClick={() => { fetchData(); setShowSettings(false); }} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">Simpan Konfigurasi</button>
          </div>
        )}

        {/* PDF Settings Modal */}
        {showPdfSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Pengaturan Kop PDF</h3>
                  <p className="text-xs text-gray-500">Sesuaikan informasi yang muncul di laporan PDF</p>
                </div>
                <button onClick={() => setShowPdfSettings(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nama Bank (Logo)</label>
                    <input 
                      type="text" 
                      value={pdfSettings.bankName} 
                      onChange={(e) => setPdfSettings({...pdfSettings, bankName: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Slogan</label>
                    <input 
                      type="text" 
                      value={pdfSettings.slogan} 
                      onChange={(e) => setPdfSettings({...pdfSettings, slogan: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nama Nasabah</label>
                  <input 
                    type="text" 
                    value={pdfSettings.customerName} 
                    onChange={(e) => setPdfSettings({...pdfSettings, customerName: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Alamat Baris 1</label>
                  <input 
                    type="text" 
                    value={pdfSettings.address1} 
                    onChange={(e) => setPdfSettings({...pdfSettings, address1: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Alamat Baris 2</label>
                  <input 
                    type="text" 
                    value={pdfSettings.address2} 
                    onChange={(e) => setPdfSettings({...pdfSettings, address2: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">No. Rekening</label>
                    <input 
                      type="text" 
                      value={pdfSettings.accountNo} 
                      onChange={(e) => setPdfSettings({...pdfSettings, accountNo: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nama Produk</label>
                    <input 
                      type="text" 
                      value={pdfSettings.productName} 
                      onChange={(e) => setPdfSettings({...pdfSettings, productName: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Valuta</label>
                  <input 
                    type="text" 
                    value={pdfSettings.currency} 
                    onChange={(e) => setPdfSettings({...pdfSettings, currency: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => setShowPdfSettings(false)}
                  className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* PDF Preview Modal */}
        {showPdfPreview && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Review Laporan (E-Statement)</h3>
                  <p className="text-xs text-gray-500">Tampilan data sebelum diekspor ke PDF</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={exportToPDF} 
                    className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    style={{ backgroundColor: themeColor }}
                  >
                    <ExternalLink size={16} /> Download PDF
                  </button>
                  <button onClick={() => setShowPdfPreview(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
                <div className="bg-white shadow-lg mx-auto max-w-[210mm] min-h-[297mm] p-[20mm] text-black font-sans">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h1 className="text-4xl font-black text-[#00529F] leading-none">{pdfSettings.bankName}</h1>
                      <p className="text-[10px] mt-1 text-[#00529F]">{pdfSettings.slogan}</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-sm font-bold uppercase">Laporan Transaksi Finansial</h2>
                      <p className="text-[10px] italic text-gray-500 uppercase">Statement of Financial Transaction</p>
                      <p className="text-[9px] mt-2">Halaman 1 dari 1</p>
                      <p className="text-[9px] italic text-gray-500">Page 1 of 1</p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="flex gap-10 mb-8">
                    <div className="border border-gray-300 p-4 w-1/2 rounded-sm">
                      <p className="text-[10px] mb-2">Kepada Yth. / To :</p>
                      <p className="text-sm font-bold mb-2">{pdfSettings.customerName}</p>
                      <p className="text-[10px] leading-relaxed">{pdfSettings.address1}</p>
                      <p className="text-[10px] leading-relaxed">{pdfSettings.address2}</p>
                    </div>
                    <div className="w-1/2 text-[10px] space-y-2">
                      <div className="flex">
                        <span className="w-32">Tanggal Laporan<br/><span className="italic text-gray-500">Statement Date</span></span>
                        <span className="mx-2">:</span>
                        <span>{format(new Date(), 'dd/MM/yy')}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32">Periode Transaksi<br/><span className="italic text-gray-500">Transaction Period</span></span>
                        <span className="mx-2">:</span>
                        <span>{format(safeParseDate(startDate), 'dd/MM/yy')} - {format(safeParseDate(endDate), 'dd/MM/yy')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="text-[10px] space-y-1 mb-8">
                    <div className="flex">
                      <span className="w-32">No. Rekening<br/><span className="italic text-gray-500">Account No</span></span>
                      <span className="mx-2">:</span>
                      <span className="font-bold">{pdfSettings.accountNo}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32">Nama Produk<br/><span className="italic text-gray-500">Product Name</span></span>
                      <span className="mx-2">:</span>
                      <span className="font-bold">{pdfSettings.productName}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32">Valuta<br/><span className="italic text-gray-500">Currency</span></span>
                      <span className="mx-2">:</span>
                      <span className="font-bold">{pdfSettings.currency}</span>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="w-full text-[9px] border-collapse">
                    <thead>
                      <tr className="bg-[#ADD8E6] border-y border-gray-300">
                        <th className="p-2 text-left border-x border-gray-300">Tanggal Transaksi</th>
                        <th className="p-2 text-left border-x border-gray-300">Uraian Transaksi</th>
                        <th className="p-2 text-left border-x border-gray-300">Teller</th>
                        <th className="p-2 text-right border-x border-gray-300">Debet</th>
                        <th className="p-2 text-right border-x border-gray-300">Kredit</th>
                        <th className="p-2 text-right border-x border-gray-300">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const saldoAwal = transactions
                          .filter(t => safeParseDate(t.tanggal).getTime() < safeParseDate(startDate).getTime())
                          .reduce((sum, t) => t.jenis === 'Pemasukan' ? sum + t.nominal : sum - t.nominal, 0);
                        
                        let currentSaldo = saldoAwal;
                        const sortedForReview = [...filteredTransactions].sort((a, b) => safeParseDate(a.tanggal).getTime() - safeParseDate(b.tanggal).getTime());
                        
                        return sortedForReview.map((t, idx) => {
                          const debet = t.jenis === 'Pengeluaran' ? t.nominal : 0;
                          const kredit = t.jenis === 'Pemasukan' ? t.nominal : 0;
                          currentSaldo += (kredit - debet);
                          
                          return (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="p-2 border-x border-gray-300">{format(safeParseDate(t.tanggal), 'dd/MM/yy HH:mm:ss')}</td>
                              <td className="p-2 border-x border-gray-300">{t.keterangan || (t.jenis === 'Pemasukan' ? 'Transfer Masuk' : 'Transfer Keluar')}</td>
                              <td className="p-2 border-x border-gray-300 text-center">8888296</td>
                              <td className="p-2 border-x border-gray-300 text-right">{debet > 0 ? debet.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
                              <td className="p-2 border-x border-gray-300 text-right">{kredit > 0 ? kredit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
                              <td className="p-2 border-x border-gray-300 text-right font-bold">{currentSaldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl flex items-center gap-2"><AlertCircle size={20}/> {error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl flex items-center gap-2"><CheckCircle2 size={20}/> {success}</div>}

        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Total Balance Summary */}
            <motion.div 
              whileTap={{ scale: 0.98 }}
              className="p-6 rounded-2xl text-white shadow-xl cursor-pointer"
              style={{ background: `linear-gradient(to bottom right, ${themeColor}, ${themeColor}cc)`, boxShadow: `0 20px 25px -5px ${themeColor}33` }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] sm:text-sm font-bold uppercase tracking-widest opacity-80">Total Seluruh Keuangan</p>
                <Wallet size={24} className="opacity-50" />
              </div>
              <h2 className="text-xl sm:text-3xl font-bold truncate">{formatCurrency(totalBalance)}</h2>
            </motion.div>

            {/* Account Balances */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {accountBalances.map((acc, i) => (
                <motion.div 
                  key={i} 
                  whileTap={{ scale: 0.95 }}
                  className="bg-white p-5 rounded-2xl border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow" 
                  style={{ borderLeftColor: acc.warna }}
                >
                  <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{acc.nama}</p>
                  <h3 className="text-base sm:text-xl font-bold truncate">{formatCurrency(acc.balance)}</h3>
                </motion.div>
              ))}
              <button 
                onClick={() => setActiveTab('rekening')} 
                className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex items-center justify-center text-gray-400 transition-all"
                style={{ borderColor: `${themeColor}33` }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = themeColor; e.currentTarget.style.color = themeColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${themeColor}33`; e.currentTarget.style.color = '#9CA3AF'; }}
              >
                <Plus size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input Form */}
              <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm h-fit">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <PlusCircle style={{ color: themeColor }} /> Tambah Transaksi
                </h3>
                <form className="space-y-4" onSubmit={(e) => {
                  e.preventDefault();
                  handlePost({ action: 'add_transaction', ...newTransaction, nominal: Number(newTransaction.nominal) });
                  setNewTransaction(prev => ({ ...prev, nominal: '', keterangan: '' }));
                }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Tanggal</label>
                      <input type="date" value={newTransaction.tanggal} onChange={e => setNewTransaction({...newTransaction, tanggal: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Jenis</label>
                      <select value={newTransaction.jenis} onChange={e => setNewTransaction({...newTransaction, jenis: e.target.value as any})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm">
                        <option value="Pengeluaran">Pengeluaran</option>
                        <option value="Pemasukan">Pemasukan</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Rekening</label>
                    <select value={newTransaction.rekening} onChange={e => setNewTransaction({...newTransaction, rekening: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm" required>
                      <option value="" disabled>Pilih Rekening</option>
                      {accounts.map(acc => <option key={acc.nama} value={acc.nama}>{acc.nama}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nominal</label>
                    <input type="number" value={newTransaction.nominal} onChange={e => setNewTransaction({...newTransaction, nominal: e.target.value})} placeholder="Contoh: 50000" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Keterangan</label>
                    <input type="text" value={newTransaction.keterangan} onChange={e => setNewTransaction({...newTransaction, keterangan: e.target.value})} placeholder="Beli makan siang..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm" required />
                  </div>
                  <button type="submit" disabled={submitting} className="w-full text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2" style={{ backgroundColor: themeColor }}>
                    {submitting ? <RefreshCw className="animate-spin" size={18}/> : <Plus size={18}/>} Simpan Transaksi
                  </button>
                </form>
              </div>

              {/* Summary Charts */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Total Pemasukan</p>
                    <h4 className="text-lg sm:text-xl font-bold text-emerald-600 truncate">{formatCurrency(stats.income)}</h4>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Total Pengeluaran</p>
                    <h4 className="text-lg sm:text-xl font-bold text-red-600 truncate">{formatCurrency(stats.expense)}</h4>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="text-emerald-600" /> Grafik Transaksi</h3>
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start">
                      <button 
                        onClick={() => setChartFilter('hari')} 
                        className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", chartFilter === 'hari' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500")}
                      >Hari</button>
                      <button 
                        onClick={() => setChartFilter('minggu')} 
                        className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", chartFilter === 'minggu' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500")}
                      >Minggu</button>
                      <button 
                        onClick={() => setChartFilter('bulan')} 
                        className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", chartFilter === 'bulan' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500")}
                      >Bulan</button>
                      <button 
                        onClick={() => setChartFilter('semua')} 
                        className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", chartFilter === 'semua' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500")}
                      >Semua</button>
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getChartData(transactions, chartFilter)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Line type="monotone" dataKey="Pemasukan" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Pengeluaran" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'riwayat' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Riwayat Transaksi</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Dari:</span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Sampai:</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm outline-none" />
                  </div>
                </div>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                  {years.map(y => <option key={y} value={y}>{y === 'All' ? 'Semua Tahun' : y}</option>)}
                </select>
                <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                  {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="All">Semua Jenis</option>
                  <option value="Pemasukan">Pemasukan</option>
                  <option value="Pengeluaran">Pengeluaran</option>
                </select>
                <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                  <option value="All">Semua Rekening</option>
                  {accounts.map(acc => <option key={acc.nama} value={acc.nama}>{acc.nama}</option>)}
                </select>
                <button 
                  onClick={() => setShowPdfSettings(true)}
                  className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 transition-all flex items-center gap-2"
                  style={{ borderColor: `${themeColor}33` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = themeColor; e.currentTarget.style.color = themeColor; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${themeColor}33`; e.currentTarget.style.color = '#6B7280'; }}
                  title="Pengaturan Kop PDF"
                >
                  <FileText size={20} />
                  <span className="text-xs font-bold md:hidden">Kop PDF</span>
                </button>
                <button 
                  onClick={() => setShowPdfPreview(true)} 
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ backgroundColor: `${themeColor}1a`, color: themeColor }}
                >
                  <Search size={16} /> Review
                </button>
                <button 
                  onClick={exportToPDF} 
                  className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg"
                  style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}33` }}
                >
                  <ExternalLink size={16} /> Export PDF
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-700 text-[11px] font-bold text-white uppercase tracking-widest">
                      <th className="px-6 py-5">Tanggal</th>
                      <th className="px-6 py-5">Jenis</th>
                      <th className="px-6 py-5">Rekening</th>
                      <th className="px-6 py-5 text-right">Nominal</th>
                      <th className="px-6 py-5">Keterangan</th>
                      <th className="px-6 py-5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTransactions.map((t, idx) => (
                      <tr key={t.id} className={cn(
                        "transition-all group",
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                        "hover:bg-emerald-50/50"
                      )}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{format(safeParseDate(t.tanggal), 'dd MMM yyyy')}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", t.jenis === 'Pemasukan' ? "bg-emerald-500" : "bg-red-500")} />
                            <span className={cn(
                              "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm", 
                              t.jenis === 'Pemasukan' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            )}>
                              {t.jenis}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">
                            {t.rekening}
                          </span>
                        </td>
                        <td className={cn("px-6 py-4 text-right font-black text-sm tabular-nums", t.jenis === 'Pemasukan' ? "text-emerald-600" : "text-red-600")}>
                          {t.jenis === 'Pemasukan' ? '+' : '-'} {formatCurrency(t.nominal)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate italic">{t.keterangan || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => setEditingTransaction(t)} 
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm border border-blue-100 bg-blue-50/50"
                              title="Edit"
                            >
                              <Edit3 size={15}/>
                            </button>
                            <button 
                              onClick={() => handlePost({ action: 'delete_transaction', id: t.id })} 
                              className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-all shadow-sm border border-red-100 bg-red-50/50"
                              title="Hapus"
                            >
                              <Trash2 size={15}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Tidak ada transaksi ditemukan</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rekening' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm h-fit">
              <h3 className="text-lg font-bold mb-6">Tambah Rekening</h3>
              <form className="space-y-4" onSubmit={(e) => {
                e.preventDefault();
                handlePost({ action: 'add_account', ...newAccount });
                setNewAccount({ nama: '', warna: DEFAULT_COLORS[0] });
              }}>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nama Rekening</label>
                  <input type="text" value={newAccount.nama} onChange={e => setNewAccount({...newAccount, nama: e.target.value})} placeholder="Contoh: Bank BCA, Cash, OVO..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Warna Tema</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {DEFAULT_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setNewAccount({...newAccount, warna: c})} className={cn("w-8 h-8 rounded-full border-2 transition-all", newAccount.warna === c ? "border-black scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
                    ))}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                      <input 
                        type="color" 
                        value={newAccount.warna} 
                        onChange={e => setNewAccount({...newAccount, warna: e.target.value})}
                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="w-full text-white py-3 rounded-xl font-bold transition-all" style={{ backgroundColor: themeColor }}>Tambah Rekening</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
              <h3 className="text-lg font-bold mb-6">Daftar Rekening</h3>
              <div className="space-y-3">
                {accounts.map((acc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: acc.warna }} />
                      <span className="font-bold">{acc.nama}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingAccount(acc)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-all"><Edit3 size={18}/></button>
                      <button onClick={() => handlePost({ action: 'delete_account', nama: acc.nama })} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"><Trash2 size={18}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Pengaturan Aplikasi</h2>
                <p className="text-gray-500">Sesuaikan tampilan dan konfigurasi dashboard Anda.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nama Aplikasi</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button 
                      onClick={() => {
                        localStorage.setItem('app_name', appName);
                        setSuccess('Nama aplikasi disimpan!');
                        setTimeout(() => setSuccess(null), 2000);
                      }}
                      className="text-white px-6 py-3 rounded-xl font-bold transition-all"
                      style={{ backgroundColor: themeColor }}
                    >
                      Simpan
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Warna Tema Aplikasi</label>
                  <div className="flex flex-wrap gap-3 items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    {DEFAULT_COLORS.map(c => (
                      <button 
                        key={c} 
                        onClick={() => setThemeColor(c)}
                        className={cn("w-10 h-10 rounded-xl border-2 transition-all", themeColor === c ? "border-black scale-110" : "border-transparent")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 flex items-center justify-center bg-white">
                      <Palette size={20} className="text-gray-400" />
                      <input 
                        type="color" 
                        value={themeColor} 
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                      />
                    </div>
                    <div className="ml-auto text-xs font-mono text-gray-400 uppercase">{themeColor}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">URL Google Apps Script</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={gasUrl}
                      onChange={(e) => setGasUrl(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="https://script.google.com/macros/s/.../exec"
                    />
                    <button 
                      onClick={() => {
                        localStorage.setItem('gas_url', gasUrl);
                        fetchData();
                        setSuccess('URL disimpan!');
                        setTimeout(() => setSuccess(null), 2000);
                      }}
                      className="text-white px-6 py-3 rounded-xl font-bold transition-all"
                      style={{ backgroundColor: themeColor }}
                    >
                      Hubungkan
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Pastikan URL ini berasal dari deployment "Web App" di Apps Script Anda.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Versi Aplikasi</span>
                  <span className="font-mono">v2.1.0</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Edit Transaksi</h3>
              <button onClick={() => setEditingTransaction(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              handlePost({ action: 'edit_transaction', ...editingTransaction });
              setEditingTransaction(null);
            }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Tanggal</label>
                  <input type="date" value={editingTransaction.tanggal.split('T')[0]} onChange={e => setEditingTransaction({...editingTransaction, tanggal: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Jenis</label>
                  <select value={editingTransaction.jenis} onChange={e => setEditingTransaction({...editingTransaction, jenis: e.target.value as any})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="Pengeluaran">Pengeluaran</option>
                    <option value="Pemasukan">Pemasukan</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Rekening</label>
                <select value={editingTransaction.rekening} onChange={e => setEditingTransaction({...editingTransaction, rekening: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm" required>
                  {accounts.map(acc => <option key={acc.nama} value={acc.nama}>{acc.nama}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nominal</label>
                <input type="number" value={editingTransaction.nominal} onChange={e => setEditingTransaction({...editingTransaction, nominal: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Keterangan</label>
                <input type="text" value={editingTransaction.keterangan} onChange={e => setEditingTransaction({...editingTransaction, keterangan: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm" required />
              </div>
              <button type="submit" disabled={submitting} className="w-full text-white py-3 rounded-xl font-bold transition-all" style={{ backgroundColor: themeColor }}>Simpan Perubahan</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Edit Rekening</h3>
              <button onClick={() => setEditingAccount(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              handlePost({ action: 'edit_account', oldNama: accounts.find(a => a.nama === editingAccount.nama)?.nama || editingAccount.nama, ...editingAccount });
            }}>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nama Rekening</label>
                <input type="text" value={editingAccount.nama} onChange={e => setEditingAccount({...editingAccount, nama: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Warna Tema</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditingAccount({...editingAccount, warna: c})} className={cn("w-8 h-8 rounded-full border-2 transition-all", editingAccount.warna === c ? "border-black scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
                  ))}
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                    <input 
                      type="color" 
                      value={editingAccount.warna} 
                      onChange={e => setEditingAccount({...editingAccount, warna: e.target.value})}
                      className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full text-white py-3 rounded-xl font-bold transition-all" style={{ backgroundColor: themeColor }}>Simpan Perubahan</button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-40">
        <MobileTabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={24} />} themeColor={themeColor} />
        <MobileTabButton active={activeTab === 'riwayat'} onClick={() => setActiveTab('riwayat')} icon={<History size={24} />} themeColor={themeColor} />
        <MobileTabButton active={activeTab === 'rekening'} onClick={() => setActiveTab('rekening')} icon={<AccountIcon size={24} />} themeColor={themeColor} />
        <MobileTabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={24} />} themeColor={themeColor} />
      </nav>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, themeColor }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, themeColor: string }) {
  return (
    <button onClick={onClick} className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
      active ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"
    )} style={active ? { color: themeColor } : {}}>
      {icon} {label}
    </button>
  );
}

function MobileTabButton({ active, onClick, icon, themeColor }: { active: boolean, onClick: () => void, icon: React.ReactNode, themeColor: string }) {
  return (
    <button onClick={onClick} className={cn(
      "p-2 transition-all",
      active ? "scale-110" : "text-gray-400"
    )} style={active ? { color: themeColor } : {}}>
      {icon}
    </button>
  );
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val);
}

function getChartData(transactions: Transaction[], filter: 'hari' | 'minggu' | 'bulan' | 'semua') {
  const now = new Date();
  
  if (filter === 'hari') {
    // Show last 7 days daily (as a trend)
    const daily = transactions.reduce((acc: any, t) => {
      const date = format(safeParseDate(t.tanggal), 'dd MMM');
      if (!acc[date]) acc[date] = { date, Pemasukan: 0, Pengeluaran: 0, ts: safeParseDate(t.tanggal).getTime() };
      acc[date][t.jenis] += t.nominal;
      return acc;
    }, {});
    return Object.values(daily).sort((a: any, b: any) => a.ts - b.ts).slice(-7);
  }
  
  if (filter === 'minggu') {
    // Show last 14 days
    const daily = transactions.reduce((acc: any, t) => {
      const date = format(safeParseDate(t.tanggal), 'dd MMM');
      if (!acc[date]) acc[date] = { date, Pemasukan: 0, Pengeluaran: 0, ts: safeParseDate(t.tanggal).getTime() };
      acc[date][t.jenis] += t.nominal;
      return acc;
    }, {});
    return Object.values(daily).sort((a: any, b: any) => a.ts - b.ts).slice(-14);
  }

  if (filter === 'bulan') {
    // Show last 30 days
    const daily = transactions.reduce((acc: any, t) => {
      const date = format(safeParseDate(t.tanggal), 'dd MMM');
      if (!acc[date]) acc[date] = { date, Pemasukan: 0, Pengeluaran: 0, ts: safeParseDate(t.tanggal).getTime() };
      acc[date][t.jenis] += t.nominal;
      return acc;
    }, {});
    return Object.values(daily).sort((a: any, b: any) => a.ts - b.ts).slice(-30);
  }

  if (filter === 'semua') {
    // Group by month
    const monthly = transactions.reduce((acc: any, t) => {
      const date = format(safeParseDate(t.tanggal), 'MMM yyyy');
      if (!acc[date]) acc[date] = { date, Pemasukan: 0, Pengeluaran: 0, ts: startOfMonth(safeParseDate(t.tanggal)).getTime() };
      acc[date][t.jenis] += t.nominal;
      return acc;
    }, {});
    return Object.values(monthly).sort((a: any, b: any) => a.ts - b.ts);
  }

  return [];
}
