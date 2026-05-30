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
  
  // 💡【新機能】選択中の年・月を管理するステート（初期値：2026年6月）
  const [currentYear, setCurrentYear] = useState(2026)
  const [currentMonth, setCurrentMonth] = useState(6)
  
  // クリック選択と十字キー移動のためのインデックス
  const [focusedStaffIndex, setFocusedStaffIndex] = useState(null)
  const [focusedDayIndex, setFocusedDayIndex] = useState(null)

  // 💡【自動計算】選択された年月の「末日（日数）」を自動取得（30日、31日、28日など）
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // 年月が切り替わるたびにデータを再フェッチ
  useEffect(() => { 
    fetchData() 
    // 年月が変わったら選択枠（青枠）を安全のために一回リセット
    setFocusedStaffIndex(null)
    setFocusedDayIndex(null)
  }, [currentYear, currentMonth])

  const kurihara = staffs.find(staff => staff.name === '栗原');
  const otherStaffs = staffs.filter(staff => staff.name !== '栗原');
  const allStaffs = kurihara ? [kurihara, ...otherStaffs] : otherStaffs;

  // 十字キー移動 ＆ 数字入力の同時監視ロジック
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (focusedStaffIndex === null || focusedDayIndex === null || loading || allStaffs.length === 0) return;

      // 1. 十字キーによる選択マスの移動（右端の移動制限をdaysInMonthに連動）
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
        setFocusedDayIndex(prev => (prev < daysInMonth - 1 ? prev + 1 : prev));
        return;
      }

      // 2. 数字キーの割り当て
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
        // 💡 日付文字列を現在の選択年月に合わせて動的生成
        const dayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(focusedDayIndex + 1).padStart(2, '0')}`;
        
        await updateShiftData(targetStaff.id, dayStr, newValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedStaffIndex, focusedDayIndex, loading, shifts, allStaffs, currentYear, currentMonth, daysInMonth]);

  // 💡【修正】選んだ年月に合わせて、取得するデータの全日付範囲を自動計算してフェッチ
  async function fetchData() {
    // 前月の末日（夜勤の引き継ぎ計算用）
    const prevMonthLastDate = new Date(currentYear, currentMonth - 1, 0);
    const prevDayStr = `${prevMonthLastDate.getFullYear()}-${String(prevMonthLastDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthLastDate.getDate()).padStart(2, '0')}`;
    
    // 当月の末日
    const todayStrMax = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const { data: sData } = await supabase.from('123').select('*').order('id', { ascending: true })
    const { data: mData } = await supabase
      .from('monthly_shifts')
      .select('*')
      .gte('date', prevDayStr) 
      .lte('date', todayStrMax)
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

  // セルクリック時はマスの選択のみを行う
  function handleCellClick(staffIndex, dayIndex) {
    setFocusedStaffIndex(staffIndex);
    setFocusedDayIndex(dayIndex);
  }

  // 集計ロジック（選択中の年月・日数に完全連動）
  const getCoverage = (dayIndex) => {
    const dayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayIndex + 1).padStart(2, '0')}`;
    
    // 前日の日付を計算
    const currentDayDate = new Date(currentYear, currentMonth - 1, dayIndex + 1);
    currentDayDate.setDate(currentDayDate.getDate() - 1);
    const prevDayStr = `${currentDayDate.getFullYear()}-${String(currentDayDate.getMonth() + 1).padStart(2, '0')}-${String(currentDayDate.getDate()).padStart(2, '0')}`;
    
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
        {/* 💡【新機能】タイトルを選んだ年月と自動連動 */}
        <h1 style={{ margin: 0, fontSize: '20px' }}>令和8年{currentMonth}月 勤務予定表</h1>
        
        {/* 💡【新機能】年月をいつでも切り替えられるプルダウンメニューを追加 */}
        <div className="no-print" style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
          <select 
            value={currentMonth} 
            onChange={(e) => setCurrentMonth(Number(e.target.value))}
            style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}
          >
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <option key={m} value={m}>{m}月度</option>
            ))}
          </select>

          <button onClick={() => window.print()} style={{ padding: '6px 16px', cursor: 'pointer', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
            🖨️ シフト表を印刷する
          </button>
        </div>
      </div>
      
      <div className="main-container" style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflowX: 'auto', marginBottom: '15px' }}>
        <table border="1" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#333', fontSize: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#eeeeee' }}>
              <th rowSpan="2" style={{ width: '40px' }}>区分</th>
              <th rowSpan="2" style={{ width: '80px' }}>氏名</th>
              <th rowSpan="2" style={{ width: '40px' }}>形態</th>
              <th rowSpan="2" style={{ width: '80px' }}>スタッフ</th>
              {/* 💡【動的化】30固定をやめ、今月の日数分だけループ回数を自動可変させる */}
              {[...Array(daysInMonth)].map((_, i) => <th key={i} style={{ width: '28px' }}>{i + 1}</th>)}
            </tr>
            <tr style={{ backgroundColor: '#eeeeee' }}>
              {/* 💡【動的化】曜日の判定も、選択中の年月と日数に完全連動 */}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = new Date(currentYear, currentMonth - 1, i + 1).getDay();
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
              // 当月データのみを抽出
              const currentStaffShifts = shifts.filter(shift => {
                const targetMonthStr = `-${String(currentMonth).padStart(2, '0')}-`;
                return shift.staff_id === staff.id && shift.date.includes(targetMonthStr);
              });
              
              return (
                <tr key={staff.id}>
                  {staffIndex === 0 && (
                    <td rowSpan={allStaffs.length + 4} style={{ textAlign: 'center', fontWeight: 'bold', borderLeft: '3px solid #333' }}>（星）</td>
                  )}
                  <td style={{ textAlign: 'center' }}>{staff.name === '栗原' ? '管理者' : '介護従事者'}</td>
                  <td style={{ textAlign: 'center' }}>{staff.name === '栗原' ? 'B' : 'C'}</td>
                  <td style={{ padding: '4px', fontWeight: 'bold', backgroundColor: '#fff' }}>{staff.name} {staff.can_kitchen && '🍳'}</td>
                  
                  {/* 💡【動的化】マス目の描画も今月の日数に100%自動追従 */}
                  {[...Array(daysInMonth)].map((_, dayIndex) => {
                    const dayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayIndex + 1).padStart(2, '0')}`;
                    const shift = currentStaffShifts.find(sh => sh.date === dayStr);
                    const isFocused = focusedStaffIndex === staffIndex && focusedDayIndex === dayIndex;
                    const displayType = shift ? shift.shift_type : "";
                    
                    return (
                      <td 
                        key={`${staff.id}-${dayIndex}`}
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
              {[...Array(daysInMonth)].map((_, i) => {
                const count = getCoverage(i).t7_9;
                return <td key={i} style={{ textAlign: 'center', color: count < 2 ? 'red' : 'inherit' }}>{count}</td>
              })}
            </tr>
            <tr className="no-print" style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', paddingRight: '10px' }}>② 10-16時 (要3)</td>
              {[...Array(daysInMonth)].map((_, i) => {
                const count = getCoverage(i).t10_16;
                return <td key={i} style={{ textAlign: 'center', color: count < 3 ? 'red' : 'inherit' }}>{count}</td>
              })}
            </tr>
            <tr className="no-print" style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', paddingRight: '10px' }}>③ 17-18時 (要3)</td>
              {[...Array(daysInMonth)].map((_, i) => {
                const count = getCoverage(i).t17_18;
                return <td key={i} style={{ textAlign: 'center', color: count < 3 ? 'red' : 'inherit' }}>{count}</td>
              })}
            </tr>
            <tr className="no-print" style={{ backgroundColor: '#fff5f5', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', paddingRight: '10px', color: '#c62828' }}>④ キッチン不在</td>
              {[...Array(daysInMonth)].map((_, i) => {
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