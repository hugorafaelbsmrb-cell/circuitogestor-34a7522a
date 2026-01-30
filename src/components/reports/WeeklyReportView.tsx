import { Star, CheckCircle, AlertTriangle, Lightbulb, ClipboardList } from 'lucide-react';
import { useSystemBranding } from '@/hooks/useSystemBranding';

interface WeeklyReportContent {
  performance?: string;
  positive_points?: string;
  difficulties?: string;
  recommendations?: string;
  observations?: string;
}

interface WeeklyReportViewProps {
  content: WeeklyReportContent;
  studentName: string;
  teacherName?: string;
  reportDate: string;
  title?: string;
}

export default function WeeklyReportView({
  content,
  studentName,
  teacherName,
  reportDate,
  title
}: WeeklyReportViewProps) {
  const { branding } = useSystemBranding();

  const sections = [
    {
      key: 'performance',
      title: 'DESEMPENHO GERAL',
      content: content.performance,
      color: '#EA580C', // Orange
      icon: Star,
    },
    {
      key: 'positive_points',
      title: 'PONTOS POSITIVOS',
      content: content.positive_points,
      color: '#16A34A', // Green
      icon: CheckCircle,
    },
    {
      key: 'difficulties',
      title: 'DIFICULDADES',
      content: content.difficulties,
      color: '#D97706', // Amber
      icon: AlertTriangle,
    },
    {
      key: 'recommendations',
      title: 'RECOMENDAÇÕES',
      content: content.recommendations,
      color: '#EA580C', // Orange
      icon: Lightbulb,
    },
    {
      key: 'observations',
      title: 'OBSERVAÇÕES',
      content: content.observations,
      color: '#6B7280', // Gray
      icon: ClipboardList,
    },
  ];

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {/* Header - 38px height */}
      <div 
        className="px-4 flex items-center gap-3"
        style={{ 
          height: '38px', 
          backgroundColor: '#F8F8F8'
        }}
      >
        {branding.logo ? (
          <img 
            src={branding.logo} 
            alt={branding.name} 
            style={{ width: '22px', height: '22px' }}
            className="object-contain"
          />
        ) : (
          <div 
            style={{ width: '22px', height: '22px' }}
            className="bg-gradient-to-br from-orange-500 to-amber-500 rounded flex items-center justify-center"
          >
            <span className="text-white text-[8px] font-bold">CK</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm text-gray-800 truncate">
              {branding.name || 'Circuito Kids'}
            </span>
            <span className="text-[9px] text-gray-500 hidden sm:inline">
              Relatório de Acompanhamento Semanal
            </span>
          </div>
        </div>
      </div>

      {/* Info line */}
      <div className="px-4 py-1.5 bg-gray-50 text-[8pt] text-gray-600 flex flex-wrap items-center gap-1">
        <span className="font-medium">{studentName}</span>
        {teacherName && (
          <>
            <span className="text-gray-400">•</span>
            <span>Prof. {teacherName}</span>
          </>
        )}
        <span className="text-gray-400">•</span>
        <span>{reportDate}</span>
      </div>

      {/* Orange divider line */}
      <div 
        style={{ 
          height: '1.5px', 
          backgroundColor: '#EA580C' 
        }} 
      />

      {/* Content sections */}
      <div className="p-4 space-y-4">
        {sections.map((section) => {
          if (!section.content) return null;
          
          const IconComponent = section.icon;
          
          return (
            <div 
              key={section.key}
              className="flex gap-3"
            >
              {/* Colored side bar - 3px width */}
              <div 
                className="rounded-full flex-shrink-0"
                style={{ 
                  width: '3px',
                  backgroundColor: section.color 
                }} 
              />
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Section title */}
                <h4 
                  className="flex items-center gap-1.5 mb-1 font-bold text-[9pt] uppercase tracking-wide"
                  style={{ color: section.color }}
                >
                  <IconComponent 
                    className="flex-shrink-0"
                    style={{ 
                      width: '14px', 
                      height: '14px',
                      color: section.color 
                    }} 
                  />
                  {section.title}
                </h4>
                
                {/* Section content */}
                <p className="text-[9pt] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Signature area */}
      <div className="px-4 pb-4 pt-2">
        <div className="border-t border-gray-200 pt-4 mt-2">
          <div className="flex gap-8">
            <div className="flex-1">
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-[8pt] text-gray-500 text-center">
                Assinatura do Professor(a)
              </p>
            </div>
            <div className="flex-1">
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-[8pt] text-gray-500 text-center">
                Assinatura do Responsável
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
