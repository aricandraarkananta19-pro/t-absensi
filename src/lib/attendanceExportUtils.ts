import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo.png";

// ============== TYPES ==============
interface EmployeeAttendance {
    name: string;
    department: string;
    present: number;
    absent: number;
    leave: number;
    late: number;
    absentDates: string[];
    lateDates: string[];
    leaveDates: string[];
    remarks: string;
    dailyStatus: Record<string, string>; // Key: "YYYY-MM-DD", Value: Status Code (H, S, I, A, T, L)
}

interface AttendanceReportData {
    period: string;
    periodStart: string;
    periodEnd: string;
    totalEmployees: number;
    totalPresent: number;
    totalAbsent: number;
    totalLeave: number;
    totalLate: number;
    employees: EmployeeAttendance[];
    leaveRequests: {
        name: string;
        department: string;
        type: string;
        startDate: string;
        endDate: string;
        days: number;
        status: string;
    }[];
}

const COMPANY_NAME = "PT. TALENTA TRAINCOM INDONESIA";
const COMPANY_DIV = "Divisi Human Resources";

// Helper to load image
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
};

// Format dates: "3, 7, 12 Januari 2026"
const formatDatesDisplay = (dates: string[], period: string): string => {
    if (dates.length === 0) return "—";
    const monthYear = new Date(period + "-01");
    const monthName = monthYear.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const days = dates.map(d => new Date(d).getDate()).sort((a, b) => a - b);
    if (days.length <= 5) return days.join(", ") + " " + monthName;
    return days.slice(0, 4).join(", ") + ` (+${days.length - 4}) ${monthName}`;
};

import ExcelJS from "exceljs";

// ============== MULTI-SHEET EXCEL EXPORT (USING EXCELJS) ==============
export const exportAttendanceExcel = async (data: AttendanceReportData, filename: string) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "T-Absensi System";
    workbook.created = new Date();

    const printDate = new Date().toLocaleString("id-ID");

    // Helper Styles
    const titleStyle: Partial<ExcelJS.Style> = { font: { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E40AF' } }, alignment: { vertical: 'middle', horizontal: 'left' } };
    const subtitleStyle: Partial<ExcelJS.Style> = { font: { name: 'Arial', size: 10, color: { argb: 'FF4A5568' } } };
    const headerStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
        border: { top: { style: 'thin', color: { argb: 'FFA0AEC0' } }, left: { style: 'thin', color: { argb: 'FFA0AEC0' } }, bottom: { style: 'thin', color: { argb: 'FFA0AEC0' } }, right: { style: 'thin', color: { argb: 'FFA0AEC0' } } }
    };
    const dataStyle: Partial<ExcelJS.Style> = { font: { name: 'Arial', size: 9 }, border: { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }, alignment: { vertical: 'middle' } };
    const dataCenterStyle: Partial<ExcelJS.Style> = { ...dataStyle, alignment: { vertical: 'middle', horizontal: 'center' } };
    const sectionHeaderStyle: Partial<ExcelJS.Style> = { font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E40AF' } }, alignment: { vertical: 'middle' } };

    // Status colors
    const goodFont = { color: { argb: 'FF047857' } };
    const badFont = { color: { argb: 'FFDC2626' } };
    const warningFont = { color: { argb: 'FFD97706' } };

    // ===== SHEET 1: Ringkasan Kehadiran =====
    const sheet1 = workbook.addWorksheet("Ringkasan Kehadiran");
    sheet1.columns = [
        { width: 25 }, { width: 20 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 25 }
    ];

    sheet1.addRow([COMPANY_NAME]).font = titleStyle.font as ExcelJS.Font;
    sheet1.addRow(["LAPORAN KEHADIRAN KARYAWAN"]).font = titleStyle.font as ExcelJS.Font;
    sheet1.addRow([`Periode: ${data.period}`]).font = subtitleStyle.font as ExcelJS.Font;
    sheet1.addRow([`Dicetak: ${printDate}`]).font = subtitleStyle.font as ExcelJS.Font;
    sheet1.addRow([]);

    sheet1.addRow(["STATISTIK KEHADIRAN"]).font = sectionHeaderStyle.font as ExcelJS.Font;
    sheet1.addRow(["Total Karyawan", data.totalEmployees]);
    const r7 = sheet1.addRow(["Total Hadir", data.totalPresent]);
    r7.getCell(2).font = goodFont;
    const r8 = sheet1.addRow(["Total Tidak Hadir", data.totalAbsent]);
    r8.getCell(2).font = badFont;
    const r9 = sheet1.addRow(["Total Cuti", data.totalLeave]);
    const r10 = sheet1.addRow(["Total Terlambat", data.totalLate]);
    r10.getCell(2).font = warningFont;

    sheet1.addRow([]);
    sheet1.addRow(["DATA KARYAWAN"]).font = sectionHeaderStyle.font as ExcelJS.Font;

    // Headers
    const headers = ["Nama Karyawan", "Departemen", "Hadir", "Tidak Hadir", "Cuti", "Terlambat", "Keterangan"];
    const headerRow = sheet1.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
        cell.style = headerStyle as ExcelJS.Style;
    });

    // Data Rows
    data.employees.forEach((e, i) => {
        const row = sheet1.addRow([
            e.name,
            e.department,
            e.present,
            e.absent,
            e.leave,
            e.late,
            e.remarks || '-'
        ]);

        // Apply styling
        const isAlt = i % 2 !== 0;
        const fill = isAlt ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : undefined;

        row.eachCell((cell, colNumber) => {
            cell.border = dataStyle.border as ExcelJS.Borders;
            cell.font = dataStyle.font as ExcelJS.Font;
            cell.alignment = colNumber > 2 && colNumber < 7 ? { horizontal: 'center', vertical: 'middle' } : { vertical: 'middle' };
            if (fill) cell.fill = fill as ExcelJS.Fill;
        });

        // Specific column styling
        if (e.absent > 0) row.getCell(4).font = { ...dataStyle.font, ...badFont };
        if (e.late > 0) row.getCell(6).font = { ...dataStyle.font, ...warningFont };
        row.getCell(3).font = { ...dataStyle.font, ...goodFont };
    });

    // Formatting widths a bit better
    sheet1.getColumn(1).width = 30;
    sheet1.getColumn(2).width = 25;

    // Signatures
    sheet1.addRow([]);
    sheet1.addRow([]);
    const sigRow1 = sheet1.addRow(["", "Dibuat Oleh,", "", "", "", "Disetujui Oleh,"]);
    sigRow1.getCell(2).font = { bold: true }; sigRow1.getCell(2).alignment = { horizontal: 'center' };
    sigRow1.getCell(6).font = { bold: true }; sigRow1.getCell(6).alignment = { horizontal: 'center' };

    sheet1.addRow([]);
    sheet1.addRow([]);
    sheet1.addRow([]);

    const sigRow2 = sheet1.addRow(["", "( HR Manager )", "", "", "", "( Direktur Utama )"]);
    sigRow2.getCell(2).font = { bold: true }; sigRow2.getCell(2).alignment = { horizontal: 'center' };
    sigRow2.getCell(6).font = { bold: true }; sigRow2.getCell(6).alignment = { horizontal: 'center' };


    // ===== SHEET 2: Detail Matrix =====
    const sheet2 = workbook.addWorksheet("Detail Kehadiran (Matrix)");
    const daysInMonth = new Date(new Date(data.periodEnd).getFullYear(), new Date(data.periodEnd).getMonth() + 1, 0).getDate();

    // Header Row construction
    const matrixHeaders = ["Nama Karyawan", "Departemen"];
    for (let d = 1; d <= daysInMonth; d++) matrixHeaders.push(String(d));

    sheet2.addRow([`DETAIL KEHADIRAN (MATRIX) - ${data.period.toUpperCase()}`]).font = titleStyle.font as ExcelJS.Font;
    sheet2.mergeCells(1, 1, 1, daysInMonth + 2);

    sheet2.addRow(["Keterangan: H=Hadir, T=Terlambat, A=Alpha, S=Sakit, I=Izin, C=Cuti, L=Libur"]).font = subtitleStyle.font as ExcelJS.Font;
    sheet2.mergeCells(2, 1, 2, daysInMonth + 2);

    sheet2.addRow([]);

    const matrixHeaderRow = sheet2.addRow(matrixHeaders);
    matrixHeaderRow.height = 22;
    matrixHeaderRow.eachCell(cell => {
        cell.style = headerStyle as ExcelJS.Style;
        if (Number(cell.text) > 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Columns width
    sheet2.getColumn(1).width = 30;
    sheet2.getColumn(2).width = 25;
    for (let i = 3; i <= daysInMonth + 2; i++) sheet2.getColumn(i).width = 4;

    data.employees.forEach((e, i) => {
        const rowValues = [e.name, e.department];
        const statusColors: any[] = []; // To store color info for this row

        for (let d = 1; d <= daysInMonth; d++) {
            const current = new Date(data.periodStart);
            current.setDate(d);
            const dateKey = current.toISOString().split('T')[0];
            const status = e.dailyStatus[dateKey] || '-';
            rowValues.push(status);

            if (status === 'H') statusColors.push(goodFont);
            else if (status === 'T') statusColors.push(warningFont);
            else if (status === 'A') statusColors.push(badFont);
            else statusColors.push({});
        }

        const row = sheet2.addRow(rowValues);
        const isAlt = i % 2 !== 0;
        const fill = isAlt ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : undefined;

        row.eachCell((cell, colNumber) => {
            cell.border = dataStyle.border as ExcelJS.Borders;
            cell.font = dataStyle.font as ExcelJS.Font;
            if (fill) cell.fill = fill as ExcelJS.Fill;

            if (colNumber > 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                const colorStyle = statusColors[colNumber - 3];
                if (colorStyle && colorStyle.color) cell.font = { ...dataStyle.font, ...colorStyle };
            }
        });
    });

    // ===== SHEET 3: Leave =====
    const sheet3 = workbook.addWorksheet("Ringkasan Cuti");
    sheet3.columns = [{ width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 10 }, { width: 15 }];

    sheet3.addRow([`LAPORAN CUTI KARYAWAN - ${data.period.toUpperCase()}`]).font = titleStyle.font as ExcelJS.Font;
    sheet3.addRow([]);

    const leaveHeaders = ["Nama Karyawan", "Departemen", "Jenis Cuti", "Tanggal Mulai", "Tanggal Selesai", "Hari", "Status"];
    const leaveHeaderRow = sheet3.addRow(leaveHeaders);
    leaveHeaderRow.height = 28;
    leaveHeaderRow.eachCell(cell => cell.style = headerStyle as ExcelJS.Style);

    if (data.leaveRequests.length > 0) {
        data.leaveRequests.forEach((l, i) => {
            const row = sheet3.addRow([
                l.name, l.department, l.type, l.startDate, l.endDate, l.days, l.status
            ]);

            const isAlt = i % 2 !== 0;
            const fill = isAlt ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : undefined;

            row.eachCell((cell, colNumber) => {
                cell.border = dataStyle.border as ExcelJS.Borders;
                cell.font = dataStyle.font as ExcelJS.Font;
                if (fill) cell.fill = fill as ExcelJS.Fill;
                if (colNumber > 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            const statusCell = row.getCell(7);
            if (l.status === 'Disetujui') statusCell.font = { ...dataStyle.font, ...goodFont };
            else if (l.status === 'Ditolak') statusCell.font = { ...dataStyle.font, ...badFont };
            else statusCell.font = { ...dataStyle.font, ...warningFont };
        });
    } else {
        sheet3.addRow(["Tidak ada data cuti"]);
    }


    // ===== SHEET 4: Info =====
    const sheet4 = workbook.addWorksheet("Informasi Laporan");
    sheet4.getColumn(1).width = 25;
    sheet4.getColumn(2).width = 40;

    sheet4.addRow(["INFORMASI LAPORAN"]).font = titleStyle.font as ExcelJS.Font;
    sheet4.addRow([]);

    const infoData = [
        ["Nama Perusahaan", COMPANY_NAME],
        ["Divisi", COMPANY_DIV],
        ["Periode Laporan", data.period],
        ["Tanggal Cetak", printDate],
        ["Jumlah Karyawan", data.totalEmployees]
    ];

    infoData.forEach((item, i) => {
        const row = sheet4.addRow(item);
        const isAlt = i % 2 !== 0; // consistent with source style which alternated
        if (isAlt) {
            row.eachCell(cell => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
        }
        row.eachCell(cell => {
            cell.font = dataStyle.font as ExcelJS.Font;
            cell.border = dataStyle.border as ExcelJS.Borders;
        });
    });

    sheet4.addRow([]);
    sheet4.addRow(["CATATAN"]).font = sectionHeaderStyle.font as ExcelJS.Font;
    sheet4.addRow(["• Data cuti diambil otomatis dari pengajuan cuti yang telah disetujui"]).font = subtitleStyle.font as ExcelJS.Font;
    sheet4.addRow(["• Hari kerja dihitung berdasarkan hari Senin–Jumat"]).font = subtitleStyle.font as ExcelJS.Font;
    sheet4.addRow(["• Laporan ini digenerate oleh T-Absensi System"]).font = subtitleStyle.font as ExcelJS.Font;

    // Generate Buffer and Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
};

// ============== HR PDF EXPORT (Detailed) ==============
export const exportAttendanceHRPDF = async (data: AttendanceReportData, filename: string) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const printDate = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Load logo
    let logoImg: HTMLImageElement | null = null;
    try { logoImg = await loadImage(logoUrl); } catch (e) { console.warn("Logo not loaded"); }

    // === HEADER ===
    if (logoImg) {
        doc.addImage(logoImg, "PNG", margin, 8, 18, 18);
        doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
        doc.text(COMPANY_NAME, margin + 22, 14);
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
        doc.text(COMPANY_DIV, margin + 22, 19);
    }

    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("LAPORAN KEHADIRAN KARYAWAN", pageWidth / 2, 32, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${data.period}`, pageWidth / 2, 38, { align: "center" });
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text(`Dicetak: ${printDate}`, pageWidth / 2, 43, { align: "center" });
    doc.setDrawColor(200); doc.line(margin, 46, pageWidth - margin, 46);

    // === SUMMARY STATS ===
    doc.setFontSize(9); doc.setTextColor(0);
    const statsY = 52;
    doc.text(`Total Karyawan: ${data.totalEmployees}`, margin, statsY);
    doc.text(`Hadir: ${data.totalPresent}`, margin + 50, statsY);
    doc.setTextColor(220, 38, 38); doc.text(`Tidak Hadir: ${data.totalAbsent}`, margin + 90, statsY);
    doc.setTextColor(217, 119, 6); doc.text(`Terlambat: ${data.totalLate}`, margin + 140, statsY);
    doc.setTextColor(0); doc.text(`Cuti: ${data.totalLeave}`, margin + 185, statsY);

    // === MAIN TABLE ===
    const tableData = data.employees.map((e, i) => [
        i + 1,
        e.name,
        e.department,
        e.present,
        e.absent,
        e.leave,
        e.late,
        e.absentDates.length > 0 || e.lateDates.length > 0 || e.leaveDates.length > 0
            ? [
                e.absentDates.length > 0 ? `Absen: ${formatDatesDisplay(e.absentDates, data.periodStart)}` : '',
                e.leaveDates.length > 0 ? `Cuti: ${formatDatesDisplay(e.leaveDates, data.periodStart)}` : '',
                e.lateDates.length > 0 ? `Telat: ${formatDatesDisplay(e.lateDates, data.periodStart)}` : '',
            ].filter(Boolean).join('\n')
            : '—',
        e.remarks || '-'
    ]);

    autoTable(doc, {
        head: [['No', 'Nama Karyawan', 'Departemen', 'Hadir', 'Tidak Hadir', 'Cuti', 'Terlambat', 'Detail Kehadiran (Tanggal)', 'Keterangan']],
        body: tableData,
        startY: 58,
        theme: "grid",
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 8, cellPadding: 2 },
        bodyStyles: { fontSize: 7, cellPadding: 2, valign: "top" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            3: { halign: "center", cellWidth: 15 },
            4: { halign: "center", cellWidth: 20 },
            5: { halign: "center", cellWidth: 12 },
            6: { halign: "center", cellWidth: 18 },
            7: { cellWidth: 70 },
            8: { cellWidth: 40 },
        },
        margin: { left: margin, right: margin, bottom: 18 },
        didDrawPage: (d) => {
            doc.setFontSize(7); doc.setTextColor(100);
            doc.text("T-Absensi System", margin, pageHeight - 8);
            doc.text(`Halaman ${d.pageNumber}`, pageWidth - margin, pageHeight - 8, { align: "right" });
        }
    });

    // === SIGNATURES ===
    let finalY = (doc as any).lastAutoTable.finalY + 15 || 65;
    if (finalY > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        finalY = 25;
    }

    doc.setFontSize(9); doc.setTextColor(0); doc.setFont("helvetica", "bold");

    // Left Signature
    doc.text("Dibuat Oleh,", margin + 20, finalY);
    doc.line(margin + 15, finalY + 20, margin + 55, finalY + 20);
    doc.text("HR Manager", margin + 25, finalY + 25);

    // Right Signature
    const rightSigX = pageWidth - margin - 50;
    doc.text("Disetujui Oleh,", rightSigX + 5, finalY);
    doc.line(rightSigX, finalY + 20, rightSigX + 40, finalY + 20);
    doc.text("Direktur Utama", rightSigX + 8, finalY + 25);

    // === APPENDIX: ATTENDANCE MATRIX PAGE ===
    doc.addPage();
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("APPENDIX: MATRIKS KEHADIRAN HARIAN", pageWidth / 2, 20, { align: "center" });

    const daysInMonth = new Date(new Date(data.periodEnd).getFullYear(), new Date(data.periodEnd).getMonth() + 1, 0).getDate();

    // Matrix Table Data
    const matrixHead = [['Nama', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))]];
    const matrixBody = data.employees.map(e => {
        const row = [e.name];
        for (let d = 1; d <= daysInMonth; d++) {
            // Construct Date Key YYYY-MM-DD
            const current = new Date(data.periodStart);
            current.setDate(d);
            const dateKey = current.toISOString().split('T')[0];
            row.push(e.dailyStatus[dateKey] || '-');
        }
        return row;
    });

    autoTable(doc, {
        head: matrixHead,
        body: matrixBody,
        startY: 25,
        theme: "grid",
        styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 30, halign: 'left' } }, // Name column wider
        margin: { top: 25, left: 10, right: 10 },
        tableWidth: 'auto'
    });

    doc.setFontSize(8);
    doc.text("Ket: H=Hadir, T=Terlambat, A=Alpha, S=Sakit, I=Izin, C=Cuti, L=Libur", 10, doc.internal.pageSize.getHeight() - 10);

    doc.save(`${filename}.pdf`);
};

// ============== MANAGEMENT PDF EXPORT (Executive Summary) ==============
export const exportAttendanceManagementPDF = async (data: AttendanceReportData, filename: string) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const printDate = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Load logo
    let logoImg: HTMLImageElement | null = null;
    try { logoImg = await loadImage(logoUrl); } catch (e) { console.warn("Logo not loaded"); }

    // === HEADER ===
    if (logoImg) {
        doc.addImage(logoImg, "PNG", margin, 15, 22, 22);
    }
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
    doc.text(COMPANY_NAME, pageWidth / 2, 22, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
    doc.text(COMPANY_DIV, pageWidth / 2, 28, { align: "center" });

    doc.setDrawColor(30, 64, 175); doc.setLineWidth(0.8);
    doc.line(margin, 35, pageWidth - margin, 35);

    // === TITLE ===
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("RINGKASAN EKSEKUTIF KEHADIRAN", pageWidth / 2, 48, { align: "center" });
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${data.period}`, pageWidth / 2, 55, { align: "center" });

    // === KEY METRICS BOX ===
    const boxY = 65;
    const boxWidth = (pageWidth - margin * 2 - 15) / 4;

    const metrics = [
        { label: "Karyawan", value: data.totalEmployees, color: [51, 65, 85] },
        { label: "Hadir", value: data.totalPresent, color: [4, 120, 87] },
        { label: "Tidak Hadir", value: data.totalAbsent, color: [220, 38, 38] },
        { label: "Terlambat", value: data.totalLate, color: [217, 119, 6] },
    ];

    metrics.forEach((m, i) => {
        const x = margin + i * (boxWidth + 5);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, boxY, boxWidth, 28, 3, 3, "F");
        doc.setFontSize(22); doc.setFont("helvetica", "bold");
        doc.setTextColor(m.color[0], m.color[1], m.color[2]);
        doc.text(String(m.value), x + boxWidth / 2, boxY + 14, { align: "center" });
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
        doc.text(m.label, x + boxWidth / 2, boxY + 22, { align: "center" });
    });

    // === INSIGHTS ===
    const insightY = 105;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
    doc.text("INSIGHT & CATATAN", margin, insightY);
    doc.setDrawColor(200); doc.line(margin, insightY + 2, pageWidth - margin, insightY + 2);

    const attendanceRate = data.totalEmployees > 0 ? Math.round((data.totalPresent / (data.totalPresent + data.totalAbsent)) * 100) : 0;
    const highAbsentees = data.employees.filter(e => e.absent >= 3).length;
    const frequentLate = data.employees.filter(e => e.late >= 5).length;

    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50);
    let y = insightY + 12;

    const insights = [
        `• Tingkat kehadiran periode ini: ${attendanceRate}%`,
        `• Total cuti yang diambil: ${data.totalLeave} hari`,
        highAbsentees > 0 ? `• Perlu perhatian: ${highAbsentees} karyawan dengan ketidakhadiran ≥3 hari` : "• Semua karyawan memiliki kehadiran baik",
        frequentLate > 0 ? `• Karyawan sering terlambat: ${frequentLate} orang` : "• Tidak ada karyawan dengan keterlambatan berlebih",
    ];

    insights.forEach(text => {
        doc.text(text, margin, y);
        y += 8;
    });

    // === TOP ABSENTEES (if any) ===
    const topAbsentees = data.employees.filter(e => e.absent > 0).sort((a, b) => b.absent - a.absent).slice(0, 5);
    if (topAbsentees.length > 0) {
        y += 8;
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
        doc.text("KARYAWAN DENGAN KETIDAKHADIRAN TERTINGGI", margin, y);
        doc.setDrawColor(200); doc.line(margin, y + 2, pageWidth - margin, y + 2);
        y += 10;

        autoTable(doc, {
            head: [["Nama", "Departemen", "Tidak Hadir", "Tanggal"]],
            body: topAbsentees.map(e => [e.name, e.department, e.absent, formatDatesDisplay(e.absentDates, data.periodStart)]),
            startY: y,
            theme: "plain",
            headStyles: { fillColor: [241, 245, 249], textColor: 50, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            columnStyles: { 2: { halign: "center" } },
            margin: { left: margin, right: margin },
        });
    }

    // === FOOTER (Signatures) ===
    const signatureY = doc.internal.pageSize.getHeight() - 50;

    doc.setFontSize(10); doc.setTextColor(0);
    // Left Signature (HR Manager)
    doc.text("Dibuat Oleh,", margin + 10, signatureY);
    doc.line(margin, signatureY + 25, margin + 40, signatureY + 25);
    doc.text("HR Manager", margin + 10, signatureY + 30);

    // Right Signature (Director)
    doc.text("Disetujui Oleh,", pageWidth - margin - 35, signatureY);
    doc.line(pageWidth - margin - 45, signatureY + 25, pageWidth - margin - 5, signatureY + 25);
    doc.text("Direktur Utama", pageWidth - margin - 32, signatureY + 30);

    // === PAGE FOOTER ===
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setDrawColor(200); doc.line(margin, footerY, pageWidth - margin, footerY);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Dokumen ini digenerate otomatis oleh T-Absensi System`, margin, footerY + 6);
    doc.text(`Dicetak: ${printDate}`, pageWidth - margin, footerY + 6, { align: "right" });

    doc.save(`${filename}.pdf`);
};

export type { AttendanceReportData, EmployeeAttendance };
