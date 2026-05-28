import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  "https://ncnvirnxmzmzdamwhanu.supabase.co", 
  "sb_publishable_f9gZpCz1to78Fz8toEYq_A_DTZzAax9"
)

const SHIFT_INFO = {
  "朝": { time: "7時～9時または7時から10時半", color: "transparent" },
  "①": { time: "7時～16時", color: "#fff9c4" },
  "②": { time: "9時～17時または9時～18時", color: "#fff9c4" },
  "③": { time: "10時半から19時半", color: "#fff9c4" },
  "夕": { time: "16時～19時半", color: "transparent" },
  "夜勤": { time: "17時から9時", color: "#c8e6c9" },
  "": { time: "-", color: "transparent" }
};

const REQUIRED_PEOPLE_FULL = [
  { time: "7時～9時", count: "2人", detail: "（夜勤1人含）" },
  { time: "9時～10時半", count: "2人", detail: "" },
  { time: "10時半～16時", count: "3人", detail: "" },
  { time: "16時～17時", count: "2人", detail: "" },
  { time: "17時～18時", count: "3人", detail: "（夜勤1人含）" },
  { time: "18時～19時半", count: "2人", detail: "（夜勤1人含）" },
  { time: "19時半～7時", count: "1人", detail: "（夜勤のみ）" }
];

function App() {
  const [staffs, setStaffs] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(false)
  
  // クリック選択と十字キー移動のためのインデックス
  const [focusedStaffIndex, setFocusedStaffIndex] = useState(null)
  const [focusedDayIndex, setFocusedDayIndex] = useState(null)

  useEffect(() => { fetchData() }, [])

  // スタッフの配列を整理（星グループとして一本化）
  const kurihara = staffs.find(staff => staff.name === '栗原');
  const otherStaffs = staffs.filter(staff => staff.name !== '栗原');
  const allStaffs = kurihara ? [kurihara, ...otherStaffs] : otherStaffs;

  // 十字キー移動 ＆ 数字入力の同時監視ロジック
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (focusedStaffIndex === null || focusedDayIndex === null || loading || allStaffs.length === 0) return;

      // 1. 十字キーによる選択マスの移動
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedStaffIndex(prev => (prev > 0 ? prev - 1 : prev));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedStaffIndex(prev => (prev < allStaffs.length - 1 ? prev + 1 : prev));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedDayIndex(prev => (prev > 0 ? prev - 1 : prev));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedDayIndex(prev => (prev < 29 ? prev + 1 : prev));
        return;
      }

      // 2. 凡例に合わせた正確な数字キーの割り当て
      let newValue = null;
      if (e.key === '1') newValue = "朝";
      else if (e.key === '2') newValue = "①";
      else if (e.key === '3') newValue = "②";
      else if (e.key === '4') newValue = "③";
      else if (e.key === '5') newValue = "夕";
      else if (e.key === '6') newValue = "夜勤";
      else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') newValue = "";

      if (newValue !== null) {
        e.preventDefault();
        const targetStaff = allStaffs[focusedStaffIndex];
        const dayStr = `2026-06-${String(focusedDayIndex + 1).padStart(2, '0')}`;
        
        await updateShiftData(targetStaff.id, dayStr, newValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedStaffIndex, focusedDayIndex, loading, shifts, allStaffs]);

  async function fetchData() {
    const { data: sData } = await supabase.from('123').select('*').order('id', { ascending: true })
    const { data: mData } = await supabase
      .from('monthly_shifts')
      .select('*')
      .gte('date', '2026-05-31') 
      .lte('date', '2026-06-30')
      .order('date', { ascending: true })

    setStaffs(sData || [])
    setShifts(mData || [])
  }

  // 古い重複データを一回「全削除」してから「1件だけピカピカにインサート」する鉄壁ロジック
  async function updateShiftData(staffId, dateStr, newValue) {
    setLoading(true)
    
    await supabase
      .from('monthly_shifts')
      .delete()
      .eq('staff_id', staffId)
      .eq('date', dateStr)
      
    if (newValue !== "") {
      await supabase
        .from('monthly_shifts')
        .insert({ staff_id: staffId, date: dateStr, shift_type: newValue })
    }
      
    await fetchData()
    setLoading(false)
  }

  // 💡【修正】セルクリック時は青枠（フォーカス）の「選択だけ」を行うようにスリム化
  function handleCellClick(staffIndex, dayIndex) {
    setFocusedStaffIndex(staffIndex);
    setFocusedDayIndex(dayIndex);
  }

  // 集計ロジック（重複を完全に排除し、画面に見えている有効な1件だけを確実にカウント）
  const getCoverage = (dayIndex) => {
    const dayStr = `2026-06-${String(dayIndex + 1).padStart(2, '0')}`;
    const prevDayStr = dayIndex === 0 ? '2026-05-31' : `2026-06-${String(dayIndex).padStart(2, '0')}`;
    
    const todayValidShifts = allStaffs.map(staff => {
      const staffShifts = shifts.filter(sh => sh.staff_id === staff.id);
      return staffShifts.find(sh => sh.date === dayStr);
    }).filter(Boolean);

    const prevValidShifts = allStaffs.map(staff => {
      const staffShifts = shifts.filter(sh => sh.staff_id === staff.id);
      return staffShifts.find(sh => sh.date === prevDayStr);
    }).filter(Boolean);

    const workingStaffIds = todayValidShifts
      .filter(sh => ["朝", "①", "②", "③"].includes(sh.shift_type))
      .map(sh => sh.staff_id);

    return {
      t7_9: todayValidShifts.filter(sh => ["朝", "①"].includes(sh.shift_type)).length + 
            prevValidShifts.filter(sh => sh.shift_type === "夜勤").length,
      t10_16: todayValidShifts.filter(sh => ["①", "②", "③"].includes(sh.shift_type)).length,
      t17_18: todayValidShifts.filter(sh => ["②", "③", "夕", "夜勤"].includes(sh.shift_type)).length,
      kitchenOk: allStaffs.some(staff => staff.can_kitchen && workingStaffIds.includes(staff.id))
    };
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: '11px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; } 
          body { padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .main-container { padding: 0 !important; background: transparent !important; box-shadow: none !important; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #000 !important; padding: 1px !important; }
          @page { size: landscape; margin: 5mm; }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>令和8年6月 勤務予定表</h1>
        <button className="no-print" onClick={() => window.print()} style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          🖨️ シフト表を印刷する
        </button>
      </div>
      
      <div className="main-container" style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflowX: 'auto', marginBottom: '15px' }}>
        <table border="1" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#333', fontSize: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#eeeeee' }}>
              <th rowSpan="2" style={{ width: '40px' }}>区分</th>
              <th rowSpan="2" style={{ width: '80px' }}>氏名</th>
              <th rowSpan="2" style={{ width: '40px' }}>形態</th>
              <th rowSpan="2" style={{ width: '80px' }}>スタッフ</th>
              {[...Array(30)].map((_, i) => <th key={i} style={{ width: '28px' }}>{i + 1}</th>)}
            </tr>
            <tr style={{ backgroundColor: '#eeeeee' }}>
              {[...Array(30)].map((_, i) => {
                const day = new Date(2026, 5, i + 1).getDay();
                const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
                return (
                  <th key={i} style={{ backgroundColor: day === 0 ? '#ffcdd2' : day === 6 ? '#bbdefb' : 'inherit' }}>
                    {dayNames[day]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allStaffs.map((staff, staffIndex) => {
              const currentStaffShifts = shifts.filter(shift => shift.staff_id === staff.id && shift.date.includes('-06-'));
              
              return (
                <tr key={staff.id}>
                  {staffIndex === 0 && (
                    <td rowSpan={allStaffs.length + 4} style={{ textAlign: 'center', fontWeight: 'bold', borderLeft: '3px solid #333' }}>（星）</td>
                  )}
                  <td style={{ textAlign: 'center' }}>{staff.name === '栗原' ? '管理者' : '介護従事者'}</td>
                  <td style={{ textAlign: 'center' }}>{staff.name === '栗原' ? 'B' : 'C'}</td>
                  <td style={{ padding: '4px', fontWeight: 'bold', backgroundColor: '#fff' }}>{staff.name} {staff.can_kitchen && '🍳'}</td>
                  
                  {[...Array(30)].map((_, dayIndex) => {
                    const dayStr = `2026-06-${String(dayIndex + 1).padStart(2, '0')}`;
                    const shift = currentStaffShifts.find(sh => sh.date === dayStr);
                    const isFocused = focusedStaffIndex === staffIndex && focusedDayIndex === dayIndex;
                    const displayType = shift ? shift.shift_type : "";
                    
                    return (
                      <td 
                        key={`${staff.id}-${dayIndex}`}
                        /* 💡【修正】クリックした時は、純粋に選択処理だけを呼び出す */
                        onClick={() => {
                          handleCellClick(staffIndex, dayIndex);
                        }}
                        style={{ 
                          padding: '8px 0', textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                          backgroundColor: SHIFT_INFO[displayType || ""].color,
                          fontWeight: displayType ? 'bold' : 'normal',
                          outline: isFocused ? '2px solid #2196F3' : 'none',
                          zIndex: isFocused ? 10 : 1,
                          position: 'relative'
                        }}
                      >
                        {displayType || "-"}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            
            {/* 検品行 */}
            <tr className="no-print" style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td colSpan="3" style={{ textAlign: 'right', paddingRight: '10px' }}>① 7-9時 (要2)</td>
              {[...Array(30)].map((_, i) => {
                const count = getCoverage(i).t7_9;
                return <td key={i} style={{ textAlign: 'center', color: count < 2 ? 'red' : 'inherit' }}>{count}</td>
              })}
            </tr>
            <tr className="no-print" style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', paddingRight: '10px' }}>② 10-16時 (要3)</td>
              {[...Array(30)].map((_, i) => {
                const count = getCoverage(i).t10_16;
                return <td key={i} style={{ textAlign: 'center', color: count < 3 ? 'red' : 'inherit' }}>{count}</td>
              })}
            </tr>
            <tr className="no-print" style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', paddingRight: '10px' }}>③ 17-18時 (要3)</td>
              {[...Array(30)].map((_, i) => {
                const count = getCoverage(i).t17_18;
                return <td key={i} style={{ textAlign: 'center', color: count < 3 ? 'red' : 'inherit' }}>{count}</td>
              })}
            </tr>
            <tr className="no-print" style={{ backgroundColor: '#fff5f5', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', paddingRight: '10px', color: '#c62828' }}>④ キッチン不在</td>
              {[...Array(30)].map((_, i) => {
                const ok = getCoverage(i).kitchenOk;
                return <td key={i} style={{ textAlign: 'center', backgroundColor: ok ? 'transparent' : '#ffcdd2' }}>{ok ? '' : '⚠️'}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 凡例セクション */}
      <div className="no-print" style={{ display: 'flex', gap: '15px' }}>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '11px', borderBottom: '1px solid #eee' }}>シフト記号入力ショートカット</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <tbody>
              {["朝", "①", "②", "③", "夕", "夜勤"].map((type, idx) => (
                <tr key={type}>
                  <td style={{ width: '30px', padding: '2px' }}>
                    <div style={{ backgroundColor: SHIFT_INFO[type].color, textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold' }}>{type}</div>
                  </td>
                  <td style={{ padding: '2px' }}>{SHIFT_INFO[type].time} <strong style={{color: '#2196F3'}}>[ キーボードの {idx + 1} ]</strong></td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '2px' }}><div style={{ textAlign: 'center', border: '1px solid #ddd' }}>-</div></td>
                <td style={{ padding: '2px' }}>シフト消去 <strong style={{color: '#2196F3'}}>[ キーボードの 0 / Backspace / Delete ]</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '11px', borderBottom: '1px solid #eee' }}>時間帯の必要人数</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '10px' }}>
            {REQUIRED_PEOPLE_FULL.map(item => (
              <div key={item.time} style={{ padding: '2px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>{item.time}</span>
                <span>{item.count} <small style={{ color: '#666' }}>{item.detail}</small></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App