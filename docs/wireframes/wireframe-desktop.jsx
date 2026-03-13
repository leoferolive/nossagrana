import { useState } from 'react';

const c = {
  bg: '#0B0D11',
  sidebar: '#111318',
  card: '#16181F',
  cardAlt: '#1C1F28',
  border: '#23262F',
  borderLight: '#2E3140',
  primary: '#22C55E',
  primaryMuted: 'rgba(34,197,94,0.12)',
  danger: '#EF4444',
  dangerMuted: 'rgba(239,68,68,0.12)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245,158,11,0.12)',
  accent: '#3B82F6',
  accentMuted: 'rgba(59,130,246,0.12)',
  text: '#E4E4EA',
  textSec: '#8B8D9A',
  textDim: '#555766',
  white: '#fff',
};

const font = "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── SHARED COMPONENTS ────────────────────────────────────────────

const Badge = ({ children, color, bg }) => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 5,
      background: bg,
      color,
      letterSpacing: '0.3px',
    }}
  >
    {children}
  </span>
);

const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: c.card,
      borderRadius: 14,
      border: `1px solid ${c.border}`,
      padding: 20,
      ...style,
    }}
  >
    {children}
  </div>
);

const CardTitle = ({ children, right }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    }}
  >
    <span style={{ fontSize: 14, fontWeight: 700, color: c.text, letterSpacing: '-0.2px' }}>
      {children}
    </span>
    {right}
  </div>
);

const SummaryBox = ({ label, value, color, icon }) => (
  <Card style={{ flex: 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div
          style={{
            fontSize: 11,
            color: c.textSec,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 6, letterSpacing: '-1px' }}>
          {value}
        </div>
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}
      >
        {icon}
      </div>
    </div>
  </Card>
);

const BudgetBar = ({ category, spent, limit, compact }) => {
  const pct = Math.min((spent / limit) * 100, 120);
  const barColor = pct >= 100 ? c.danger : pct >= 80 ? c.warning : c.primary;
  return (
    <div style={{ marginBottom: compact ? 10 : 14 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}
      >
        <span style={{ color: c.text, fontWeight: 600 }}>{category}</span>
        <span style={{ color: c.textSec }}>
          R${spent} <span style={{ color: c.textDim }}>/</span> R${limit}{' '}
          <span style={{ color: barColor, fontWeight: 700 }}>({Math.round(pct)}%)</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: c.border }}>
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            background: barColor,
            width: `${Math.min(pct, 100)}%`,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  );
};

const MiniChart = ({ data, height = 60, color = c.primary, showDots = true, fill = false }) => {
  const max = Math.max(...data) * 1.1;
  const w = 100 / (data.length - 1);
  const points = data.map((v, i) => `${i * w},${height - (v / max) * (height - 8)}`).join(' ');
  const fillPoints = `0,${height} ${points} 100,${height}`;
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {fill && <polygon points={fillPoints} fill={`${color}15`} />}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        data.map((v, i) => (
          <circle
            key={i}
            cx={i * w}
            cy={height - (v / max) * (height - 8)}
            r="2.5"
            fill={c.bg}
            stroke={color}
            strokeWidth="1.5"
          />
        ))}
    </svg>
  );
};

const PieChart = ({ data, size = 140 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const colors = [
    '#22C55E',
    '#3B82F6',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg viewBox="0 0 100 100" style={{ width: size, height: size, flexShrink: 0 }}>
        <circle cx="50" cy="50" r="30" fill={c.bg} />
        {data.map((d, i) => {
          const pct = d.value / total;
          const start = acc;
          acc += pct;
          const x1 = 50 + 42 * Math.cos(2 * Math.PI * start - Math.PI / 2);
          const y1 = 50 + 42 * Math.sin(2 * Math.PI * start - Math.PI / 2);
          const x2 = 50 + 42 * Math.cos(2 * Math.PI * acc - Math.PI / 2);
          const y2 = 50 + 42 * Math.sin(2 * Math.PI * acc - Math.PI / 2);
          const ix1 = 50 + 26 * Math.cos(2 * Math.PI * acc - Math.PI / 2);
          const iy1 = 50 + 26 * Math.sin(2 * Math.PI * acc - Math.PI / 2);
          const ix2 = 50 + 26 * Math.cos(2 * Math.PI * start - Math.PI / 2);
          const iy2 = 50 + 26 * Math.sin(2 * Math.PI * start - Math.PI / 2);
          const large = pct > 0.5 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M${ix2},${iy2} L${x1},${y1} A42,42 0 ${large},1 ${x2},${y2} L${ix1},${iy1} A26,26 0 ${large},0 ${ix2},${iy2} Z`}
              fill={colors[i % colors.length]}
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: colors[i % colors.length],
                flexShrink: 0,
              }}
            />
            <span style={{ color: c.textSec, minWidth: 90 }}>{d.label}</span>
            <span style={{ color: c.text, fontWeight: 700 }}>R${d.value.toLocaleString()}</span>
            <span style={{ color: c.textDim, fontSize: 11 }}>
              ({Math.round((d.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Input = ({ label, placeholder, type = 'text', ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && (
      <label
        style={{
          fontSize: 11,
          color: c.textSec,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </label>
    )}
    <input
      type={type}
      placeholder={placeholder}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${c.border}`,
        background: c.cardAlt,
        color: c.text,
        fontSize: 13,
        outline: 'none',
        boxSizing: 'border-box',
        width: '100%',
      }}
      {...props}
    />
  </div>
);

const Select = ({ label, options }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && (
      <label
        style={{
          fontSize: 11,
          color: c.textSec,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </label>
    )}
    <select
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${c.border}`,
        background: c.cardAlt,
        color: c.text,
        fontSize: 13,
        outline: 'none',
        appearance: 'none',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  </div>
);

const Btn = ({ children, primary, danger, small, onClick, style: s = {} }) => (
  <div
    onClick={onClick}
    style={{
      padding: small ? '6px 14px' : '10px 20px',
      borderRadius: 8,
      background: primary ? c.primary : danger ? c.danger : c.cardAlt,
      color: primary || danger ? c.white : c.textSec,
      fontWeight: 700,
      fontSize: small ? 11 : 13,
      cursor: 'pointer',
      textAlign: 'center',
      border: `1px solid ${primary ? c.primary : danger ? c.danger : c.border}`,
      transition: 'opacity 0.15s',
      ...s,
    }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
  >
    {children}
  </div>
);

// ─── SIDEBAR ──────────────────────────────────────────────────────

const Sidebar = ({ active, onNavigate }) => {
  const sections = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'extrato', icon: '📋', label: 'Extrato' },
    { id: 'relatorios', icon: '📊', label: 'Relatórios' },
    { id: 'historico', icon: '📅', label: 'Histórico' },
    { id: '_divider' },
    { id: 'categorias', icon: '🏷️', label: 'Categorias' },
    { id: 'cartoes', icon: '💳', label: 'Cartões' },
    { id: 'orcamento', icon: '🎯', label: 'Orçamento' },
    { id: '_divider2' },
    { id: 'familia', icon: '👨‍👩‍👧', label: 'Família' },
    { id: 'ajuda', icon: '❓', label: 'Ajuda' },
  ];

  return (
    <div
      style={{
        width: 220,
        background: c.sidebar,
        borderRight: `1px solid ${c.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${c.border}` }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: c.primary, letterSpacing: '-0.5px' }}>
          NossaGrana
        </div>
        <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>Família Silva</div>
      </div>
      <div
        style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {sections.map((s) =>
          s.id.startsWith('_divider') ? (
            <div key={s.id} style={{ height: 1, background: c.border, margin: '8px 10px' }} />
          ) : (
            <div
              key={s.id}
              onClick={() => onNavigate(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                background: active === s.id ? c.primaryMuted : 'transparent',
                color: active === s.id ? c.primary : c.textSec,
                transition: 'all 0.15s',
                fontSize: 13,
                fontWeight: active === s.id ? 700 : 500,
              }}
              onMouseEnter={(e) => {
                if (active !== s.id) e.currentTarget.style.background = c.cardAlt;
              }}
              onMouseLeave={(e) => {
                if (active !== s.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{s.icon}</span>
              <span>{s.label}</span>
            </div>
          ),
        )}
      </div>
      <div
        style={{
          padding: '16px 14px',
          borderTop: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: c.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.white,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          L
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>Leo</div>
          <div style={{ fontSize: 10, color: c.textDim }}>leo@email.com</div>
        </div>
      </div>
    </div>
  );
};

// ─── TRANSACTION MODAL ────────────────────────────────────────────

const TransactionModal = ({ onClose }) => {
  const [tipo, setTipo] = useState('despesa');
  const [parcelado, setParcelado] = useState(false);
  const [recorrente, setRecorrente] = useState(false);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: c.bg,
          borderRadius: 16,
          border: `1px solid ${c.border}`,
          padding: 28,
          width: 520,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: c.text }}>Nova Transação</span>
          <span
            onClick={onClose}
            style={{ fontSize: 18, color: c.textDim, cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {['despesa', 'receita'].map((t) => (
            <div
              key={t}
              onClick={() => setTipo(t)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                background:
                  tipo === t ? (t === 'despesa' ? c.dangerMuted : c.primaryMuted) : c.cardAlt,
                color: tipo === t ? (t === 'despesa' ? c.danger : c.primary) : c.textDim,
                border: `1px solid ${tipo === t ? (t === 'despesa' ? c.danger : c.primary) : c.border}`,
                textTransform: 'capitalize',
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Valor" placeholder="R$ 0,00" />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Select
                label="Categoria"
                options={[
                  'Alimentação',
                  'Moradia',
                  'Transporte',
                  'Lazer',
                  'Saúde',
                  'Assinaturas',
                  'Compras',
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Select
                label="Pagamento"
                options={['Nubank Crédito', 'Itaú Crédito', 'PIX', 'Dinheiro']}
              />
            </div>
          </div>
          <Input label="Descrição" placeholder="Ex: Supermercado semanal" />
          <Input label="Data" type="date" defaultValue="2026-03-11" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div
              onClick={() => {
                setParcelado(!parcelado);
                if (!parcelado) setRecorrente(false);
              }}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: parcelado ? c.accentMuted : c.cardAlt,
                color: parcelado ? c.accent : c.textDim,
                border: `1px solid ${parcelado ? c.accent : c.border}`,
              }}
            >
              Parcelado
            </div>
            <div
              onClick={() => {
                setRecorrente(!recorrente);
                if (!recorrente) setParcelado(false);
              }}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: recorrente ? c.accentMuted : c.cardAlt,
                color: recorrente ? c.accent : c.textDim,
                border: `1px solid ${recorrente ? c.accent : c.border}`,
              }}
            >
              Recorrente
            </div>
          </div>
          {parcelado && <Input label="Número de Parcelas" placeholder="12" type="number" />}
          {recorrente && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Select label="Frequência" options={['Mensal', 'Semanal', 'Quinzenal']} />
              </div>
              <div style={{ flex: 1 }}>
                <Input label="Até (opcional)" type="date" />
              </div>
            </div>
          )}
          <Btn primary onClick={onClose} style={{ marginTop: 8 }}>
            Salvar Transação
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── SCREENS ──────────────────────────────────────────────────────

const transactions = [
  {
    date: '11/03',
    desc: 'Supermercado Extra',
    cat: 'Alimentação',
    val: -180,
    user: 'Maria',
    method: 'Nubank',
    badge: null,
  },
  {
    date: '10/03',
    desc: 'Uber para o trabalho',
    cat: 'Transporte',
    val: -32,
    user: 'Leo',
    method: 'Itaú',
    badge: null,
  },
  {
    date: '09/03',
    desc: 'Salário março',
    cat: 'Salário',
    val: 5000,
    user: 'Leo',
    method: 'PIX',
    badge: null,
  },
  {
    date: '09/03',
    desc: 'Salário março',
    cat: 'Salário',
    val: 4200,
    user: 'Maria',
    method: 'PIX',
    badge: null,
  },
  {
    date: '08/03',
    desc: 'Netflix',
    cat: 'Assinaturas',
    val: -39,
    user: 'Leo',
    method: 'Itaú',
    badge: 'Recorrente',
  },
  {
    date: '07/03',
    desc: 'Geladeira Brastemp',
    cat: 'Compras',
    val: -250,
    user: 'Maria',
    method: 'Nubank',
    badge: '3/12',
  },
  {
    date: '06/03',
    desc: 'Farmácia São Paulo',
    cat: 'Saúde',
    val: -67,
    user: 'Leo',
    method: 'PIX',
    badge: null,
  },
  {
    date: '05/03',
    desc: 'Restaurante Outback',
    cat: 'Lazer',
    val: -189,
    user: 'Maria',
    method: 'Nubank',
    badge: null,
  },
  {
    date: '04/03',
    desc: 'Gasolina',
    cat: 'Transporte',
    val: -220,
    user: 'Leo',
    method: 'Itaú',
    badge: null,
  },
  {
    date: '03/03',
    desc: 'Spotify',
    cat: 'Assinaturas',
    val: -22,
    user: 'Leo',
    method: 'Nubank',
    badge: 'Recorrente',
  },
  {
    date: '02/03',
    desc: 'Mercado Livre - Capa celular',
    cat: 'Compras',
    val: -45,
    user: 'Maria',
    method: 'Nubank',
    badge: null,
  },
  {
    date: '01/03',
    desc: 'Aluguel',
    cat: 'Moradia',
    val: -2000,
    user: 'Leo',
    method: 'PIX',
    badge: 'Recorrente',
  },
];

const DashboardScreen = () => (
  <div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: c.text,
            margin: 0,
            letterSpacing: '-0.5px',
          }}
        >
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: c.textSec, margin: '4px 0 0' }}>
          Março 2026 · Atualizado agora
        </p>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      <SummaryBox label="Receitas" value="R$9.200" color={c.primary} icon="↑" />
      <SummaryBox label="Despesas" value="R$6.350" color={c.danger} icon="↓" />
      <SummaryBox label="Saldo" value="R$2.850" color={c.accent} icon="=" />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
      <Card>
        <CardTitle>Despesas por Categoria</CardTitle>
        <PieChart
          data={[
            { label: 'Alimentação', value: 1900 },
            { label: 'Moradia', value: 2000 },
            { label: 'Transporte', value: 650 },
            { label: 'Lazer', value: 640 },
            { label: 'Assinaturas', value: 160 },
            { label: 'Outros', value: 1000 },
          ]}
        />
      </Card>
      <Card>
        <CardTitle>Evolução de Gastos</CardTitle>
        <MiniChart data={[800, 1200, 2100, 2800, 3500, 4200, 4900, 5600, 6350]} height={80} fill />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: c.textDim,
            marginTop: 6,
            padding: '0 2px',
          }}
        >
          <span>01/03</span>
          <span>05/03</span>
          <span>08/03</span>
          <span>11/03</span>
        </div>
      </Card>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card>
        <CardTitle>Orçamento do Mês</CardTitle>
        <BudgetBar category="Alimentação" spent={980} limit={1200} />
        <BudgetBar category="Moradia" spent={2000} limit={2000} />
        <BudgetBar category="Transporte" spent={410} limit={400} />
        <BudgetBar category="Lazer" spent={450} limit={500} />
        <BudgetBar category="Saúde" spent={67} limit={300} />
      </Card>
      <Card>
        <CardTitle>Últimas Transações</CardTitle>
        {transactions.slice(0, 5).map((t, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: i < 4 ? `1px solid ${c.border}` : 'none',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: t.val > 0 ? c.primaryMuted : c.dangerMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                color: t.val > 0 ? c.primary : c.danger,
                flexShrink: 0,
              }}
            >
              {t.val > 0 ? '↑' : '↓'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: c.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.desc}
              </div>
              <div style={{ fontSize: 10, color: c.textDim }}>
                {t.date} · {t.user}
              </div>
            </div>
            <span
              style={{ fontSize: 13, fontWeight: 700, color: t.val > 0 ? c.primary : c.danger }}
            >
              {t.val > 0 ? '+' : ''}R${Math.abs(t.val)}
            </span>
          </div>
        ))}
      </Card>
    </div>

    <Card style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>💡</span>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: c.textSec, flexWrap: 'wrap' }}>
          <span>
            Transporte ultrapassou o limite em <b style={{ color: c.danger }}>R$10</b>
          </span>
          <span>
            Lazer está em <b style={{ color: c.warning }}>90%</b> do orçamento
          </span>
          <span>
            Moradia atingiu <b style={{ color: c.danger }}>100%</b> do limite
          </span>
        </div>
      </div>
    </Card>
  </div>
);

const ExtratoScreen = () => {
  const [filter, setFilter] = useState('todos');
  const filtered = transactions.filter(
    (t) =>
      filter === 'todos' ||
      (filter === 'receitas' && t.val > 0) ||
      (filter === 'despesas' && t.val < 0),
  );
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: 0 }}>Extrato</h1>
          <p style={{ fontSize: 13, color: c.textSec, margin: '4px 0 0' }}>
            Março 2026 · {filtered.length} transações
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['todos', 'receitas', 'despesas'].map((f) => (
            <div
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === f ? c.primaryMuted : c.card,
                color: filter === f ? c.primary : c.textSec,
                border: `1px solid ${filter === f ? c.primary : c.border}`,
                textTransform: 'capitalize',
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${c.border}` }}>
              {['Data', 'Descrição', 'Categoria', 'Membro', 'Pagamento', 'Valor'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: c.textDim,
                    textAlign: h === 'Valor' ? 'right' : 'left',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: `1px solid ${c.border}`,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.cardAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px', fontSize: 12, color: c.textSec }}>{t.date}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: c.text }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.desc}
                    {t.badge && (
                      <Badge color={c.accent} bg={c.accentMuted}>
                        {t.badge}
                      </Badge>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: c.textSec }}>{t.cat}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: c.textSec }}>{t.user}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: c.textSec }}>{t.method}</td>
                <td
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.val > 0 ? c.primary : c.danger,
                    textAlign: 'right',
                  }}
                >
                  {t.val > 0 ? '+' : ''}R${Math.abs(t.val)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const RelatoriosScreen = () => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: '0 0 4px' }}>Relatórios</h1>
    <p style={{ fontSize: 13, color: c.textSec, margin: '0 0 20px' }}>Março 2026</p>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
      <Card>
        <CardTitle>Distribuição de Gastos</CardTitle>
        <PieChart
          data={[
            { label: 'Alimentação', value: 1900 },
            { label: 'Moradia', value: 2000 },
            { label: 'Transporte', value: 650 },
            { label: 'Lazer', value: 640 },
            { label: 'Assinaturas', value: 160 },
            { label: 'Outros', value: 1000 },
          ]}
        />
      </Card>
      <Card>
        <CardTitle>Gastos por Membro</CardTitle>
        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { name: 'Leo', val: 3200, pct: 50.4 },
            { name: 'Maria', val: 3150, pct: 49.6 },
          ].map((u) => (
            <div
              key={u.name}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 10,
                background: c.cardAlt,
                textAlign: 'center',
                border: `1px solid ${c.border}`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: c.primaryMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: c.primary,
                  fontWeight: 700,
                  fontSize: 16,
                  margin: '0 auto 10px',
                }}
              >
                {u.name[0]}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{u.name}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: c.text,
                  margin: '6px 0 2px',
                  letterSpacing: '-0.5px',
                }}
              >
                R${u.val.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: c.textDim }}>{u.pct}% do total</div>
            </div>
          ))}
        </div>
      </Card>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card>
        <CardTitle>Evolução Mensal (6 meses)</CardTitle>
        <MiniChart data={[5200, 6100, 9400, 6150, 7300, 6350]} height={80} color={c.accent} fill />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: c.textDim,
            marginTop: 6,
          }}
        >
          <span>Out</span>
          <span>Nov</span>
          <span>Dez</span>
          <span>Jan</span>
          <span>Fev</span>
          <span>Mar</span>
        </div>
      </Card>
      <Card>
        <CardTitle>Tendências</CardTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: '📈', text: 'Alimentação subiu 12% vs fevereiro', color: c.danger },
            { icon: '📉', text: 'Transporte caiu 8% vs fevereiro', color: c.primary },
            { icon: '⚠️', text: 'Lazer gastou 25% mais que fevereiro', color: c.warning },
            { icon: '🎯', text: '3 de 5 categorias dentro do orçamento', color: c.accent },
          ].map((t, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                background: c.cardAlt,
                border: `1px solid ${c.border}`,
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 12, color: c.textSec }}>{t.text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

const HistoricoScreen = () => {
  const meses = [
    { mes: 'Março 2026', rec: 9200, desp: 6350, saldo: 2850, atual: true },
    { mes: 'Fevereiro 2026', rec: 8800, desp: 7300, saldo: 1500, divergente: true },
    { mes: 'Janeiro 2026', rec: 9000, desp: 6150, saldo: 2850 },
    { mes: 'Dezembro 2025', rec: 11200, desp: 9400, saldo: 1800 },
    { mes: 'Novembro 2025', rec: 8800, desp: 6500, saldo: 2300 },
    { mes: 'Outubro 2025', rec: 8600, desp: 5200, saldo: 3400 },
  ];
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: '0 0 20px' }}>
        Histórico de Meses
      </h1>
      <Card style={{ marginBottom: 14 }}>
        <CardTitle>Evolução Receita × Despesa × Saldo</CardTitle>
        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
          {[
            { label: 'Receita', color: c.primary },
            { label: 'Despesa', color: c.danger },
            { label: 'Saldo', color: c.accent },
          ].map((l) => (
            <div
              key={l.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: c.textSec,
              }}
            >
              <div style={{ width: 12, height: 3, borderRadius: 2, background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <MiniChart data={[8600, 8800, 11200, 9000, 8800, 9200]} height={60} color={c.primary} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <MiniChart
              data={[5200, 6500, 9400, 6150, 7300, 6350]}
              height={60}
              color={c.danger}
              showDots={false}
            />
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <MiniChart
              data={[3400, 2300, 1800, 2850, 1500, 2850]}
              height={60}
              color={c.accent}
              showDots={false}
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: c.textDim,
            marginTop: 6,
          }}
        >
          {meses
            .map((m) => <span key={m.mes}>{m.mes.split(' ')[0].substring(0, 3)}</span>)
            .reverse()}
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${c.border}` }}>
              {['Mês', 'Receitas', 'Despesas', 'Saldo', 'Status'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: c.textDim,
                    textAlign:
                      h === 'Saldo' || h === 'Receitas' || h === 'Despesas' ? 'right' : 'left',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meses.map((m, i) => (
              <tr
                key={i}
                style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.cardAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: c.text }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.mes}
                    {m.atual && (
                      <Badge color={c.primary} bg={c.primaryMuted}>
                        ATUAL
                      </Badge>
                    )}
                  </div>
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: c.primary,
                    textAlign: 'right',
                  }}
                >
                  R${m.rec.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: c.danger,
                    textAlign: 'right',
                  }}
                >
                  R${m.desp.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 14,
                    fontWeight: 800,
                    color: c.accent,
                    textAlign: 'right',
                  }}
                >
                  R${m.saldo.toLocaleString()}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {m.divergente ? (
                    <Badge color={c.warning} bg={c.warningMuted}>
                      ⚠ Divergente
                    </Badge>
                  ) : (
                    <Badge color={c.primary} bg={c.primaryMuted}>
                      ✓ OK
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const CategoriasScreen = () => (
  <div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: 0 }}>Categorias</h1>
      <Btn primary small>
        + Nova Categoria
      </Btn>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card>
        <CardTitle>Despesas</CardTitle>
        {[
          'Moradia',
          'Alimentação',
          'Transporte',
          'Saúde',
          'Lazer',
          'Educação',
          'Assinaturas',
          'Compras',
          'Outros',
        ].map((cat, i) => (
          <div
            key={cat}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < 8 ? `1px solid ${c.border}` : 'none',
            }}
          >
            <span style={{ fontSize: 13, color: c.text }}>{cat}</span>
            <span style={{ fontSize: 11, color: c.textDim, cursor: 'pointer' }}>editar</span>
          </div>
        ))}
      </Card>
      <Card>
        <CardTitle>Receitas</CardTitle>
        {['Salário', 'Bônus', 'Investimentos', 'Outros'].map((cat, i) => (
          <div
            key={cat}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < 3 ? `1px solid ${c.border}` : 'none',
            }}
          >
            <span style={{ fontSize: 13, color: c.text }}>{cat}</span>
            <span style={{ fontSize: 11, color: c.textDim, cursor: 'pointer' }}>editar</span>
          </div>
        ))}
      </Card>
    </div>
  </div>
);

const CartoesScreen = () => (
  <div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: 0 }}>
        Cartões e Pagamentos
      </h1>
      <Btn primary small>
        + Novo Método
      </Btn>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {[
        {
          name: 'Nubank Crédito',
          tipo: 'crédito',
          fecha: '03',
          vence: '10',
          user: 'Leo',
          icon: '💳',
          color: '#8B5CF6',
        },
        {
          name: 'Itaú Crédito',
          tipo: 'crédito',
          fecha: '15',
          vence: '22',
          user: 'Maria',
          icon: '💳',
          color: '#F97316',
        },
        { name: 'PIX', tipo: 'pix', user: 'Ambos', icon: '⚡', color: '#06B6D4' },
        { name: 'Dinheiro', tipo: 'dinheiro', user: 'Ambos', icon: '💵', color: '#22C55E' },
      ].map((card, i) => (
        <Card key={i} style={{ cursor: 'pointer' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{card.name}</div>
              <div style={{ fontSize: 12, color: c.textSec, marginTop: 6 }}>Dono: {card.user}</div>
              {card.tipo === 'crédito' && (
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: c.textDim, fontWeight: 600 }}>FECHA</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
                      Dia {card.fecha}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: c.textDim, fontWeight: 600 }}>VENCE</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
                      Dia {card.vence}
                    </div>
                  </div>
                </div>
              )}
              {card.tipo !== 'crédito' && (
                <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
                  {card.tipo.toUpperCase()}
                </div>
              )}
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `${card.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              {card.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

const OrcamentoScreen = () => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: '0 0 4px' }}>
      Orçamento Mensal
    </h1>
    <p style={{ fontSize: 13, color: c.textSec, margin: '0 0 20px' }}>Vigente desde Março 2026</p>
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${c.border}` }}>
            {['Categoria', 'Limite', 'Gasto', 'Disponível', 'Progresso', ''].map((h) => (
              <th
                key={h}
                style={{
                  padding: '12px 16px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: c.textDim,
                  textAlign:
                    h === 'Limite' || h === 'Gasto' || h === 'Disponível' ? 'right' : 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { cat: 'Alimentação', limit: 1200, spent: 980 },
            { cat: 'Moradia', limit: 2000, spent: 2000 },
            { cat: 'Transporte', limit: 400, spent: 410 },
            { cat: 'Lazer', limit: 500, spent: 450 },
            { cat: 'Saúde', limit: 300, spent: 67 },
            { cat: 'Assinaturas', limit: 200, spent: 139 },
          ].map((b, i) => {
            const pct = Math.round((b.spent / b.limit) * 100);
            const barColor = pct >= 100 ? c.danger : pct >= 80 ? c.warning : c.primary;
            const disp = b.limit - b.spent;
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${c.border}` }}>
                <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: c.text }}>
                  {b.cat}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    color: c.textSec,
                    textAlign: 'right',
                  }}
                >
                  R${b.limit.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: c.text,
                    textAlign: 'right',
                  }}
                >
                  R${b.spent.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: disp >= 0 ? c.primary : c.danger,
                    textAlign: 'right',
                  }}
                >
                  {disp >= 0 ? '' : '-'}R${Math.abs(disp)}
                </td>
                <td style={{ padding: '14px 16px', width: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: c.border }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 3,
                          background: barColor,
                          width: `${Math.min(pct, 100)}%`,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: barColor,
                        minWidth: 32,
                        textAlign: 'right',
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: 11, color: c.textDim, cursor: 'pointer' }}>editar</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  </div>
);

const FamiliaScreen = () => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: '0 0 20px' }}>
      Família Silva
    </h1>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card>
        <CardTitle>Membros</CardTitle>
        {[
          { name: 'Leo', role: 'Admin', email: 'leo@email.com' },
          { name: 'Maria', role: 'Membro', email: 'maria@email.com' },
        ].map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: i === 0 ? `1px solid ${c.border}` : 'none',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: c.primaryMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: c.primary,
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {m.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{m.name}</div>
              <div style={{ fontSize: 11, color: c.textDim }}>{m.email}</div>
            </div>
            <Badge
              color={m.role === 'Admin' ? c.primary : c.textSec}
              bg={m.role === 'Admin' ? c.primaryMuted : c.cardAlt}
            >
              {m.role}
            </Badge>
          </div>
        ))}
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <CardTitle>Código de Convite</CardTitle>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: c.cardAlt,
              borderRadius: 8,
              border: `1px solid ${c.border}`,
            }}
          >
            <code
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: 600,
                color: c.accent,
                letterSpacing: '1px',
              }}
            >
              FAM-8X2K-9P1M
            </code>
            <Btn small>Copiar</Btn>
          </div>
        </Card>
        <Card>
          <CardTitle>Solicitações Pendentes</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: c.warningMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: c.warning,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              C
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Carlos</div>
              <div style={{ fontSize: 11, color: c.textDim }}>carlos@email.com</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn primary small>
                Aceitar
              </Btn>
              <Btn small>Recusar</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
);

const AjudaScreen = () => {
  const [open, setOpen] = useState(null);
  const faqs = [
    {
      cat: 'Transações',
      items: [
        {
          q: 'Como cadastrar uma transação?',
          a: "Clique no botão '+ Nova Transação' no canto superior direito. Preencha valor, categoria, descrição e método de pagamento. Clique em 'Salvar'.",
        },
        {
          q: 'Como funciona o parcelamento?',
          a: "Ao marcar 'Parcelado' e informar o número de parcelas, o sistema cria automaticamente uma transação para cada parcela nos meses seguintes, com o valor dividido igualmente.",
        },
        {
          q: 'O que é uma transação recorrente?',
          a: 'Uma transação que se repete automaticamente. Ex: Netflix, aluguel. O sistema cria o lançamento todo mês até você cancelar.',
        },
      ],
    },
    {
      cat: 'Orçamento',
      items: [
        {
          q: 'O que significa o alerta de orçamento?',
          a: 'Amarelo = você atingiu 80% do limite. Vermelho = ultrapassou 100%. Ajuste seus gastos ou edite o limite.',
        },
        {
          q: 'Posso mudar o limite no meio do mês?',
          a: 'Sim. O novo limite começa a valer imediatamente, e o histórico do limite anterior é preservado.',
        },
      ],
    },
    {
      cat: 'Família',
      items: [
        {
          q: 'Como convidar alguém para minha família?',
          a: 'Vá em Família > Código de Convite. Compartilhe o código com a pessoa. Ela pode usá-lo no cadastro para entrar direto.',
        },
        {
          q: 'Posso editar transações de outros membros?',
          a: 'Sim. Todos os membros da família podem editar todas as transações.',
        },
      ],
    },
    {
      cat: 'Relatórios',
      items: [
        {
          q: 'O que é o snapshot mensal?',
          a: "No fim de cada mês, o sistema salva uma 'foto' dos totais. Assim, mesmo que você edite algo depois, o relatório original fica preservado.",
        },
        {
          q: "O que significa 'Divergente'?",
          a: 'Significa que transações daquele mês foram editadas após o snapshot. O relatório original continua disponível para comparação.',
        },
      ],
    },
  ];
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: '0 0 4px' }}>Ajuda</h1>
      <p style={{ fontSize: 13, color: c.textSec, margin: '0 0 20px' }}>
        Perguntas frequentes sobre o NossaGrana
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {faqs.map((section) => (
          <Card key={section.cat}>
            <CardTitle>{section.cat}</CardTitle>
            {section.items.map((faq, i) => {
              const key = `${section.cat}-${i}`;
              const isOpen = open === key;
              return (
                <div
                  key={i}
                  style={{
                    borderBottom: i < section.items.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}
                >
                  <div
                    onClick={() => setOpen(isOpen ? null : key)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{ fontSize: 13, fontWeight: 600, color: isOpen ? c.primary : c.text }}
                    >
                      {faq.q}
                    </span>
                    <span
                      style={{
                        color: c.textDim,
                        fontSize: 14,
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      ›
                    </span>
                  </div>
                  {isOpen && (
                    <div
                      style={{
                        fontSize: 12,
                        color: c.textSec,
                        lineHeight: 1.6,
                        padding: '0 0 12px',
                        paddingLeft: 12,
                        borderLeft: `2px solid ${c.primary}`,
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────

export default function NossaGranaDesktop() {
  const [screen, setScreen] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);

  const screens = {
    dashboard: DashboardScreen,
    extrato: ExtratoScreen,
    relatorios: RelatoriosScreen,
    historico: HistoricoScreen,
    categorias: CategoriasScreen,
    cartoes: CartoesScreen,
    orcamento: OrcamentoScreen,
    familia: FamiliaScreen,
    ajuda: AjudaScreen,
  };

  const Screen = screens[screen] || DashboardScreen;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: c.bg,
        fontFamily: font,
        color: c.text,
        overflow: 'hidden',
      }}
    >
      <Sidebar active={screen} onNavigate={setScreen} />
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: c.bg,
            borderBottom: `1px solid ${c.border}`,
            padding: '12px 32px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Btn
            primary
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nova Transação
          </Btn>
        </div>
        <div style={{ padding: '24px 32px 40px' }}>
          <Screen />
        </div>
      </div>
      {showModal && <TransactionModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
