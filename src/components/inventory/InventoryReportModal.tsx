import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileText, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FixedAsset {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  acquisition_date: string;
  acquisition_value: number;
  current_value: number | null;
  location: string | null;
  condition: string;
  status: string;
  depreciation_rate: number | null;
  useful_life_years: number | null;
  notes: string | null;
}

interface InventoryReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: FixedAsset[];
}

const reportTypes = [
  { value: 'complete', label: 'Relatório Completo' },
  { value: 'summary', label: 'Resumo por Categoria' },
  { value: 'depreciation', label: 'Relatório de Depreciação' },
  { value: 'location', label: 'Relatório por Localização' }
];

const conditions: Record<string, string> = {
  excellent: 'Excelente',
  good: 'Bom',
  regular: 'Regular',
  poor: 'Ruim',
  unusable: 'Inutilizável'
};

const statuses: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Em Manutenção',
  disposed: 'Baixado',
  transferred: 'Transferido'
};

export function InventoryReportModal({ open, onOpenChange, assets }: InventoryReportModalProps) {
  const [reportType, setReportType] = useState('complete');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeValues, setIncludeValues] = useState(true);
  const [includeDepreciation, setIncludeDepreciation] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Filter assets based on options
    let filteredAssets = assets;
    if (!includeInactive) {
      filteredAssets = assets.filter(a => a.status === 'active');
    }

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Inventário - Ativos Imobilizados', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 28, { align: 'center' });

    let yPosition = 40;

    if (reportType === 'complete') {
      // Complete report with all assets
      const tableData = filteredAssets.map(asset => {
        const row = [
          asset.code,
          asset.name,
          asset.category,
          asset.location || '-',
          conditions[asset.condition] || asset.condition,
          statuses[asset.status] || asset.status
        ];
        
        if (includeValues) {
          row.push(formatCurrency(asset.current_value || asset.acquisition_value));
        }
        
        return row;
      });

      const headers = ['Código', 'Nome', 'Categoria', 'Localização', 'Condição', 'Status'];
      if (includeValues) headers.push('Valor');

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });

      // Summary at the end
      const finalY = (doc as any).lastAutoTable.finalY || yPosition;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total de Ativos: ${filteredAssets.length}`, 14, finalY + 10);
      
      if (includeValues) {
        const totalValue = filteredAssets.reduce((sum, a) => sum + (a.current_value || a.acquisition_value), 0);
        doc.text(`Valor Total: ${formatCurrency(totalValue)}`, 14, finalY + 17);
      }

    } else if (reportType === 'summary') {
      // Summary by category
      const categoryGroups = filteredAssets.reduce((acc, asset) => {
        if (!acc[asset.category]) {
          acc[asset.category] = { count: 0, totalValue: 0 };
        }
        acc[asset.category].count++;
        acc[asset.category].totalValue += asset.current_value || asset.acquisition_value;
        return acc;
      }, {} as Record<string, { count: number; totalValue: number }>);

      const tableData = Object.entries(categoryGroups).map(([category, data]) => [
        category,
        data.count.toString(),
        includeValues ? formatCurrency(data.totalValue) : '-'
      ]);

      autoTable(doc, {
        head: [['Categoria', 'Quantidade', 'Valor Total']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });

      const finalY = (doc as any).lastAutoTable.finalY || yPosition;
      const totalAssets = filteredAssets.length;
      const totalValue = filteredAssets.reduce((sum, a) => sum + (a.current_value || a.acquisition_value), 0);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Geral: ${totalAssets} ativos`, 14, finalY + 12);
      if (includeValues) {
        doc.text(`Valor Total: ${formatCurrency(totalValue)}`, 14, finalY + 20);
      }

    } else if (reportType === 'depreciation') {
      // Depreciation report
      const assetsWithDepreciation = filteredAssets.filter(a => a.depreciation_rate || a.useful_life_years);
      
      const tableData = assetsWithDepreciation.map(asset => {
        const acquisitionValue = asset.acquisition_value;
        const currentValue = asset.current_value || acquisitionValue;
        const depreciated = acquisitionValue - currentValue;
        const depreciationPercent = ((depreciated / acquisitionValue) * 100).toFixed(1);
        
        return [
          asset.code,
          asset.name,
          formatCurrency(acquisitionValue),
          formatCurrency(currentValue),
          formatCurrency(depreciated),
          `${depreciationPercent}%`,
          asset.depreciation_rate ? `${asset.depreciation_rate}%` : '-',
          asset.useful_life_years ? `${asset.useful_life_years} anos` : '-'
        ];
      });

      autoTable(doc, {
        head: [['Código', 'Nome', 'Valor Aquisição', 'Valor Atual', 'Depreciação', '% Deprec.', 'Taxa Anual', 'Vida Útil']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });

    } else if (reportType === 'location') {
      // Report by location
      const locationGroups = filteredAssets.reduce((acc, asset) => {
        const location = asset.location || 'Sem localização';
        if (!acc[location]) {
          acc[location] = [];
        }
        acc[location].push(asset);
        return acc;
      }, {} as Record<string, FixedAsset[]>);

      Object.entries(locationGroups).forEach(([location, locationAssets], index) => {
        if (index > 0) {
          yPosition = (doc as any).lastAutoTable.finalY + 15;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(location, 14, yPosition);
        
        const tableData = locationAssets.map(asset => [
          asset.code,
          asset.name,
          asset.category,
          conditions[asset.condition] || asset.condition,
          includeValues ? formatCurrency(asset.current_value || asset.acquisition_value) : '-'
        ]);

        autoTable(doc, {
          head: [['Código', 'Nome', 'Categoria', 'Condição', 'Valor']],
          body: tableData,
          startY: yPosition + 5,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [100, 116, 139], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] }
        });
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    const reportName = `inventario_${reportType}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
    doc.save(reportName);
    onOpenChange(false);
  };

  const printPreview = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let filteredAssets = assets;
    if (!includeInactive) {
      filteredAssets = assets.filter(a => a.status === 'active');
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Inventário</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #1f2937; }
          .date { text-align: center; color: #6b7280; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          th { background-color: #3b82f6; color: white; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .summary { margin-top: 20px; font-weight: bold; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>Relatório de Inventário - Ativos Imobilizados</h1>
        <p class="date">Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Localização</th>
              <th>Condição</th>
              <th>Status</th>
              ${includeValues ? '<th>Valor</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${filteredAssets.map(asset => `
              <tr>
                <td>${asset.code}</td>
                <td>${asset.name}</td>
                <td>${asset.category}</td>
                <td>${asset.location || '-'}</td>
                <td>${conditions[asset.condition] || asset.condition}</td>
                <td>${statuses[asset.status] || asset.status}</td>
                ${includeValues ? `<td>${formatCurrency(asset.current_value || asset.acquisition_value)}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="summary">
          <p>Total de Ativos: ${filteredAssets.length}</p>
          ${includeValues ? `<p>Valor Total: ${formatCurrency(filteredAssets.reduce((sum, a) => sum + (a.current_value || a.acquisition_value), 0))}</p>` : ''}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Gerar Relatório de Inventário
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Relatório</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Opções</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeInactive"
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(checked as boolean)}
              />
              <label htmlFor="includeInactive" className="text-sm">
                Incluir ativos inativos/baixados
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeValues"
                checked={includeValues}
                onCheckedChange={(checked) => setIncludeValues(checked as boolean)}
              />
              <label htmlFor="includeValues" className="text-sm">
                Incluir valores monetários
              </label>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              <strong>{assets.length}</strong> ativos serão incluídos no relatório
              {!includeInactive && ` (${assets.filter(a => a.status === 'active').length} ativos)`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={printPreview}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button className="flex-1" onClick={generatePDF}>
            <Download className="w-4 h-4 mr-2" />
            Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
