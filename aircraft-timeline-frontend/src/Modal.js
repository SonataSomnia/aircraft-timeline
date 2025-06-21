// src/Modal.js
import React, { useState, useEffect } from 'react';
import './App.css';

const DIS_OPTIONS = [
  { value: '1', label: '1', indexKey: 'flight' },
  { value: '2', label: '2', indexKey: 'aircraft' },
  { value: '3', label: '3', indexKey: 'airport' }
];

const DisruptionForm = ({ onSubmit, onClose, initialData, onDataChange }) => {
  const [formData, setFormData] = useState(initialData || {
    dis: '1',
    ind_dis: '',
    dis_time: '',
    dis_value: ''
  });

  useEffect(() => {
    if (onDataChange) {
      onDataChange(formData);
    }
  }, [formData, onDataChange]);

  useEffect(() => {
    if (formData.dis === '2') {
      setFormData(prev => ({...prev, dis_value: 0}));
    }
  }, [formData.dis]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    // 不再自动关闭，由父组件控制
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>扰动数据录入</h3>
        <form onSubmit={handleSubmit}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>字段</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'left' }}>输入值</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>扰动类型 (dis):</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  <select
                    required
                    style={{ width: '100%', padding: '6px' }}
                    value={formData.dis}
                    onChange={(e) => {
                      const selected = DIS_OPTIONS.find(o => o.value === e.target.value);
                      setFormData({
                        ...formData,
                        dis: e.target.value,
                        ind_dis: selected.indexKey
                      });
                    }}
                  >
                    {DIS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>指标 (ind_dis):</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  <input
                    type="text"
                    required
                    pattern={formData.dis === '3' ? undefined : "[0-9]+"}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#f5f5f5' }}
                    value={formData.ind_dis}
                    onChange={(e) => setFormData({ ...formData, ind_dis: e.target.value })}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>时间 (dis_time):</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      required
                      min="0"
                      style={{ width: '100%', padding: '6px' }}
                      value={formData.dis_time}
                      onChange={(e) => setFormData({...formData, dis_time: e.target.value})}
                    />
                    <span style={{ whiteSpace: 'nowrap' }}>min</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px' }}>值 (dis_value):</td>
                <td style={{ padding: '8px' }}>
                  {formData.dis === '3' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        pattern="[0-9]{4}"
                        placeholder="HHMM"
                        style={{ width: '100%', padding: '6px' }}
                        value={formData.dis_value?.split('-')[0] || ''}
                        onChange={(e) => {
                          const end = formData.dis_value?.split('-')[1] || '';
                          setFormData({...formData, dis_value: `${e.target.value}-${end}`});
                        }}
                      />
                      <span>-</span>
                      <input
                        type="text"
                        pattern="[0-9]{4}"
                        placeholder="HHMM"
                        style={{ width: '100%', padding: '6px' }}
                        value={formData.dis_value?.split('-')[1] || ''}
                        onChange={(e) => {
                          const start = formData.dis_value?.split('-')[0] || '';
                          setFormData({...formData, dis_value: `${start}-${e.target.value}`});
                        }}
                      />
                    </div>
                  ) : (
                    <input
                      type="number"
                      required={formData.dis === '1'}
                      disabled={formData.dis === '2'}
                      step="1"
                      style={{ width: '100%', padding: '6px', ...(formData.dis === '2' && { backgroundColor: '#f5f5f5' }) }}
                      value={formData.dis === '2' ? '' : formData.dis_value}
                      onChange={(e) => setFormData({...formData, dis_value: e.target.value})}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="modal-actions" style={{ marginTop: '20px', textAlign: 'right' }}>
            <button type="button" onClick={onClose} className="cancel-btn">
              取消
            </button>
            <button type="submit" className="submit-btn">
              提交
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FlightCard = ({ color, flightType, DET, ART, DEP, ARR, overlap }) => (
    <div className="flight-card-wrapper">
        <div
            className="top-bar"
            style={{
                height: '7px',
                backgroundColor: color,
                marginBottom: '8px'
            }}
        />
        <div
            className="flight-card"
            style={{
                backgroundColor: overlap ? '#ffaaaaee' : 'white',
                border: `2px solid ${color}`,
                borderRadius: '8px',
                padding: '6px',
            }}
        >
            <div className="flight-info" >
                <span className="type">✈️ {flightType}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'0.66em'}}>
                    <span className="DET">{DET}</span>
                    <span className="ART">{ART}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' , fontSize: '0.66em' }}>
                    <span className="DEP">{DEP}</span>
                    <span className="ARR">{ARR}</span>
                </div>
            </div>
        </div>
    </div>
);

const minuteToHhmm = (minute) => {
    let hhmm = Math.floor(minute / 60) * 100 + minute % 60;
    hhmm=hhmm%2400;
    return hhmm.toString().padStart(4, '0'); // 使用 padStart 补全4位前导零
};

function setFlightCard(item){
    item.content = (
        <FlightCard
            color={item.color}
            flightType={item.TYPE}
            DET={minuteToHhmm(item.DET)}
            ART={minuteToHhmm(item.ART)}
            DEP={item.DEP}
            ARR={item.ARR}
            overlap={item.overlap}
        />
    )
}



const EditForm = ({ item, onSubmit, onClose }) => {
  const [formData, setFormData] = useState(item);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000 
    }}>
      <div className="modal-content" style={{
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
      }}>
        <h3>编辑航班属性: {item.id}</h3>
        <form onSubmit={handleSubmit}>
          {Object.entries(item).map(([key, value]) => {
            if (['id', 'status', 'content', 'group', 'className', 'style', 'editable', 'color','overlap','Flight','start','end'].includes(key)) return null;
            return (
              <div className="form-group" key={key}>
                <label>{key}:</label>
                <input
                  type="text"
                  value={formData[key] ?? ''}
                  onChange={(e) => setFormData({...formData, [key]: e.target.value.toString()})}
                />
              </div>
            );
          })}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>取消</button>
            <button type="submit">确认</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export {
  FlightCard,
  minuteToHhmm,
  setFlightCard,
  DisruptionForm,
  EditForm
};