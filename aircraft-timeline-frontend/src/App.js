// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import './App.css';
import { Timeline, DataSet } from 'vis/dist/vis.js';
import 'vis/dist/vis-timeline-graph2d.min.css';
import Papa from 'papaparse';
import {
  FlightCard,
  minuteToHhmm,
  setFlightCard,
  DisruptionForm,
  EditForm
} from './Modal';
var data = [];
var dataModified = [];
var items = []
var groups = []
const FILE_OPTIONS = ['cost_93.csv', 'cost_573.csv', 'cost_911.csv', 'cost_1079.csv', 'cost_1359.csv']
const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calculationStatus, setCalculationStatus] = useState('idle');
  const [uploadingDisruption, setUploadingDisruption] = useState(false);
  const [uploadDisruptionError, setUploadDisruptionError] = useState(null);
  const [uploadingModification, setUploadingModification] = useState(false);
  const [uploadModificationError, setUploadModificationError] = useState(null);
  const [showDisruptionForm, setShowDisruptionForm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [formData, setFormData] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modified, setModified] = useState(false);
  const [file, setFile] = useState('cost_93.csv');
  const timelineRef = useRef(null);
  const timelineContainerRef = useRef(null);



  // 生成唯一颜色的工具函数（基于航班号+索引）
  const stringToColor = (flightNumber, index, opacity) => {
    const str = `${flightNumber}-${index}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsla(${hash % 360}, 70%, 40%,${opacity})`;
    return color;
  };



  const timelineBaseDate = new Date(2023, 0, 1);
  const timelineStart = new Date(timelineBaseDate);
  timelineStart.setSeconds(timelineBaseDate.getSeconds());
  const timelineEnd = new Date(timelineBaseDate);
  timelineEnd.setSeconds(timelineBaseDate.getSeconds()+300000);

  const getData = async (file) => {
    try {
      setLoading(true);
      setError(null);
      const savedData = localStorage.getItem('savedData');
      if (file===undefined || savedData) {
        data = JSON.parse(savedData).data;
        dataModified = JSON.parse(savedData).dataModified;
        console.log('从本地读取缓存');
      }
      else {
        data = await fetchData(file);
        dataModified = data.map(item => ({
          ...item,
          status: `modified`,
        }));
        localStorage.setItem('savedData', JSON.stringify({ data, dataModified }));
      }
    } catch (err) {
      setError('数据加载失败: ' + err.message);
      setLoading(false);
    }
  }


  const fetchData = async (file) => {
    // 直接加载本地CSV文件
    const response = await fetch(`http://localhost:5000/api/get_data?file=${file}`);
    if (!response.ok) {
      throw new Error(`文件加载失败: ${response.status}`);
    }
    const csvData = await response.json();



    const parsedData = Papa.parse(csvData.data, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimiter: ',',  // 显式指定分隔符
      quoteChar: '"',  // 明确引用符
      escapeChar: '\\' // 处理转义字符
    });

    if (parsedData.errors.length > 0) {
      throw new Error('CSV解析错误: ' + parsedData.errors[0].message);
    }


    // 缓存数据
    const data = parsedData.data.map(item => ({
      ...item,
      status: `original`,
    }));

    return data;


  };

  const convertData = async () => {
    // 转换航班数据为时间轴格式
    const combinedData = [...data, ...dataModified];
    const transformedItems = combinedData.flatMap((item) => {
      const originalGroupId = parseInt(item.AC, 10);
      const backupGroupId = originalGroupId + 0.5;
      const color = stringToColor(item.Flight, item.AC, item.status === 'original' ? 1 : 0.5);
      const timelineItem = {
        ...item,
        id: item.status === 'original' ?
          `${item.TYPE}-${item.Flight}` :
          `${item.TYPE}-${item.Flight}-modified`,
        content: (
          <FlightCard
            color={color}
            flightType={item.TYPE}
            DET={minuteToHhmm(item.DET)}
            ART={minuteToHhmm(item.ART)}
            DEP={item.DEP}
            ARR={item.ARR}
            overlap={false}
          />
        ),
        start: new Date(timelineBaseDate.getTime() + item.DET*60 * 1000),
        end: new Date(timelineBaseDate.getTime() + item.ART *60* 1000),
        group: item.status === 'original' ? originalGroupId : backupGroupId,
        className: item.status === 'original' ? 'flight-item' : 'flight-item-modified',
        style: `background-color: #ffffff00;`,
        editable: {
          updateTime: item.status !== 'original', // 禁止original条目移动
          updateGroup: item.status !== 'original' // 禁止original条目切换分组
        },
        color: color,
        overlap: false,
      };


      return timelineItem;
    });

    

    // 按飞机型号创建分组（原始+备份）
    const aircraftTypes = [...new Set(data.map(item => item.AC))];
    const transformedGroups = aircraftTypes.flatMap(aircraft => {
      const originalId = parseInt(aircraft, 10);
      return [
        {
          id: originalId,
          content: `<div class="airline-header" style="height: 1.5em;">${aircraft}</div>`,
          className: 'aircraft-group',
          style: 'background-color: #f8f9fa; border-left: 4px solid #007bff;'
        },
        {
          id: originalId + 0.5,
          content: `<div class="airline-header" style="height: 1.5em;">${aircraft} </div>`,
          className: 'aircraft-group-modified',
          style: 'background-color: rgba(248, 249, 250, 0.5); border-left: 4px solid rgba(0, 123, 255, 0.5);'
        }
      ];
    });


    items = new DataSet(transformedItems);

    groups = new DataSet(transformedGroups);
    const initOverlapIntervals = transformedGroups.flatMap(group => {
      console.log(group);
      return updateOverlap([group.id]);
    })
    items.add(initOverlapIntervals);
    console.log(items);
    setLoading(false);
  }
  const convertUpdatedData = async () => {
    const newData = await fetchData('new_schedule.csv');
    console.log(newData);
    const transformedItems = newData.flatMap((item) => {
      const originalGroupId = parseInt(item.AC, 10);
      const color = stringToColor(item.Flight, item.AC, 1);
      const timelineItem = {
        ...item,
        id: `${item.TYPE}-${item.Flight}`,
        content: (
          <FlightCard
            color={color}
            flightType={item.TYPE}
            DET={minuteToHhmm(item.DET)}
            ART={minuteToHhmm(item.ART)}
            DEP={item.DEP}
            ARR={item.ARR}
            overlap={false}
          />
        ),
        start: new Date(timelineBaseDate.getTime() + item.DET * 60 * 1000),
        end: new Date(timelineBaseDate.getTime() + item.ART * 60 * 1000),
        group:  originalGroupId,
        className: 'flight-item',
        style: `background-color: #ffffff00;`,
        editable: {
          updateTime: false,
          updateGroup: false,
        },
        color: color,
        overlap: false,
      };
      return timelineItem;
    });
    items.remove(data.map(datum => `${datum.TYPE}-${datum.Flight}`));
    items.add(transformedItems);
    setCalculationStatus('idle')
    // groups = new DataSet(transformedGroups);
    // const initOverlapIntervals = transformedGroups.flatMap(group => {
    //   console.log(group);
    //   return updateOverlap([group.id]);
    // })
    // items.add(initOverlapIntervals);
    // console.log(items);
    // setLoading(false);
  }

  useEffect(() => {
    if (items.length === 0 || groups.length === 0 || !timelineContainerRef.current) return;

    const options = {
      editable: true,
      margin: { item: 20 },
      orientation: 'top',
      selectable: true,
      showCurrentTime: true,
      clickToUse: true,
      zoomMin: 1000 * 60 * 60, // 5分钟
      zoomMax: 1000 * 60 * 60 * 72, // 24小时
      moveable: true,
      timeAxis: {
        scale: 'minute',
        step: 60
      },
      min: timelineStart,
      max: timelineEnd,
      groupOrder: (a, b) => a.id - b.id,
      stack: false, // 禁用自动堆叠
      maxHeight: '640px',
      multiselect: true,
      onMove: function (item, callback) {
        const originalItem = items.get(item.id);
        handleItemMoved(item, originalItem, callback);
      },
      onUpdate: handleItemUpdated,
      onAdd:()=>{},
      groupHeightMode: "fixed",
      template: (item, element, data) => {
        return ReactDOMServer.renderToString(item.content);
      },
    };

    timelineRef.current = new Timeline(
      timelineContainerRef.current,
      items,
      groups,
      options
    );



    return () => {
      if (timelineRef.current) {
        timelineRef.current.destroy();
      }

    };
  }, [items, groups]);

  // 更新重叠状态
  const updateOverlap = (groupList) => {
    const allOverlaps = [];

    groupList.forEach(group => {
      const groupItems = items.get({ filter: item => item.group === group && item.type !== 'background' });

      // 重置所有overlap状态
      groupItems.forEach(item => {
        item.overlap = false;
        setFlightCard(item);
        items.update(item);
      });

      // 扫描线算法实现
      const events = [];
      groupItems.forEach(item => {
        events.push({ time: item.start.getTime(), type: 'start', item });
        events.push({ time: item.end.getTime(), type: 'end', item });
      });

      // 排序事件（时间相同则结束事件在前）
      events.sort((a, b) => a.time - b.time || (a.type === 'end' ? -1 : 1));

      let activeCount = 0;
      let activeItems = [];
      let overlapStart = null;
      const overlapIntervals = [];

      events.forEach(event => {
        if (event.type === 'start') {
          activeCount++;
          activeItems.push(event.item);
          if (activeCount > 1) {
            if (!overlapStart) {
              overlapStart = event.time;
            }
            // 标记所有活跃项为重叠
            activeItems.forEach(item => {
              console.log(item);
              item.overlap = true;
              setFlightCard(item);
              items.update(item);
            });
          }
        } else {
          activeCount--;
          activeItems = activeItems.filter(i => i.id !== event.item.id);
          if (activeCount === 1 && overlapStart !== null) {
            overlapIntervals.push({
              id: `overlap-${group}-${overlapStart}`,
              group: group,
              className: "overlap-interval",
              type: "background",
              start: new Date(overlapStart),
              end: new Date(event.time)
            });
            overlapStart = null;
            console.log(overlapIntervals);
          }
        }
      });

      // 处理剩余重叠区间
      if (overlapStart !== null) {
        overlapIntervals.push({
          id: `overlap-${group}-${overlapStart}`,
          group: group,
          className: "overlap-interval",
          type: "background",
          start: new Date(overlapStart),
          end: new Date(events[events.length - 1].time)
        });
        console.log(overlapIntervals);
      }

      allOverlaps.push(...overlapIntervals);
    });
    return allOverlaps;
  };

  // 处理项目移动
  const handleItemMoved = (item, oldItem, callback) => {
    console.log(item.group % 1, item.group)
    if (item.group % 1 === 0) {

      callback(null);
      return;
    }
    const hasOverlap = items.get().some(otherItem => {
      // 同一分组且不是自己
      return otherItem.group === item.group &&
        otherItem.id !== item.id &&
        item.start < otherItem.end &&
        item.end > otherItem.start;
    });

    if (hasOverlap) {
      item.overlap = true;
    } else {
      item.overlap = false;
    }
    items.update(item);
    const oldGroup = oldItem.group;
    const newGroup = item.group;

    items.remove(items.get({
      filter: item => item.className === 'overlap-interval' && (item.group === oldGroup || item.group === newGroup)
    }).map(item => item.id));

    if (oldGroup === newGroup) {
      items.add(updateOverlap([oldGroup]));
    } else {
      items.add(updateOverlap([oldGroup, newGroup]));
    }

    // 将时间转换为相对于基准时间的分钟数
    const dateToMinute = (date) => {
      const diff = date - timelineBaseDate;
      return Math.round(diff / 1000 / 60);
    };



    // 找到对应的数据记录
    const record=findData(item);
    console.log('moving', item.start, item.end, item.id, item.group);
    if (record) {
      // 更新时间数据
      record.DET = dateToMinute(item.start);
      record.ART = dateToMinute(item.end) ;
      item.DET = record.DET;
      item.ART = record.ART;
      setFlightCard(item);
      record.AC = Math.floor(item.group).toString();
      item.AC = record.AC
      localStorage.setItem('savedData', JSON.stringify({ data, dataModified }));
      setModified(true);
    }

    callback(item);
  };

  const findData=(item)=>{
    // 解析航班号和状态
    const [type, flight, status] = item.id.split('-');
    const targetArray = dataModified;
    const record = targetArray.find(r =>
      r.TYPE == type &&
      r.Flight === parseInt(flight)
    );
    console.log(record)
    return record
  }
  // 处理项目更新

  const handleItemUpdated = (item, callback) => {
    if(item.status==="original"){
      callback(null);
      return;
    }
    const record = findData(item);
    if (record) {
      setSelectedItem(item);
      setShowEditForm(true);
    }
    callback(item);
  
  }

  const handleFormSubmit = (formData) => {
    const record = findData(selectedItem);
    const oldGroup=record.group;
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'status') {
        if (["AC", "FT", "DIS", "DET", "ART", "CAP", "DEL", "COST", "DEM", "TIC", "P1", "P2", "P1_cost", "P2_cost"].includes(key)){
          record[key] = parseInt(value, 10);
        }
        else{
          record[key] = value;
        }
        selectedItem[key] = record[key];

      }
    });
    
    // 更新本地存储
    localStorage.setItem('savedData', JSON.stringify({ data, dataModified }));
    setModified(true);
    // 更新时间轴项目显示
    selectedItem.content = (
      <FlightCard
        color={selectedItem.color}
        flightType={record.TYPE}
        DET={minuteToHhmm(record.DET)}
        ART={minuteToHhmm(record.ART)}
        DEP={record.DEP}
        ARR={record.ARR}
        overlap={selectedItem.overlap}
      />
    );
    selectedItem.start = new Date(timelineBaseDate.getTime() + record.DET * 60 * 1000);
    selectedItem.end = new Date(timelineBaseDate.getTime() + record.ART * 60 * 1000);
    selectedItem.group = parseInt(record.AC, 10)+0.5;
    record.group = selectedItem.group;
    const newGroup = record.group;


    console.log(record, selectedItem);
    items.update(selectedItem);
    items.remove(items.get({
      filter: item => item.className === 'overlap-interval' && (item.group === oldGroup || item.group === newGroup)
    }).map(item => item.id));
    if (newGroup === oldGroup) {
      items.add(updateOverlap([oldGroup]));
    } else {
      items.add(updateOverlap([newGroup, oldGroup]));
    }
    // 关闭表单
    setShowEditForm(false);
  };


  const uploadModification = async () => {
    try {
      setUploadingModification(true);
      setUploadModificationError(null);
      const response = await fetch('http://localhost:5000/api/upload_modification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file:file,dataModified: JSON.parse(localStorage.getItem('savedData')).dataModified }),
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }

      const result = await response.json();
      console.log('修改数据上传成功:', result);
      setUploadModificationError(null);
    } catch (err) {
      setUploadModificationError('修改数据上传失败: ' + err.message);
    } finally {
      setUploadingModification(false);
    }
  };

  const uploadDisruption = () => {
    setShowDisruptionForm(true);
    // 保留之前填写的表单数据
    if (!formData) {
      setFormData({
        dis: '1',
        ind_dis: 'flight',
        dis_time: '',
        dis_value: ''
      });
    }
  };

  const handleDisruptionSubmit = async (formData) => {
    try {
      setUploadingDisruption(true);
      setUploadDisruptionError(null);
      const response = await fetch('http://localhost:5000/api/submit_disruption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`提交失败: ${response.status}`);
      }

      const result = await response.json();
      console.log('提交成功:', result);
      setUploadDisruptionError(null);
    } catch (err) {
      setUploadDisruptionError('扰动提交失败: ' + err.message);
    } finally {
      setUploadingDisruption(false);
      setShowDisruptionForm(false);
    }
  };

  const calculate = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: file, is_modified: modified }),
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }

      const result = await response.json();
      console.log('修改数据上传成功:', result);
      // 添加SSE监听
      const eventSource = new EventSource('http://localhost:5000/api/stream');
      eventSource.addEventListener('end', () => {
        eventSource.close();
        setCalculationStatus('completed');
      });
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setCalculationStatus(data.status);
          console.log(eventSource.readyState);
          console.log(data);
        } catch (err) {
          console.error('SSE解析错误:', err);
        }
      };

      eventSource.onerror = (e) => {
        if (e.eventPhase === EventSource.CLOSED) {
          console.log('SSE连接正常关闭');
        } else {
          console.log('SSE连接错误:', e);
        }
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };

    } catch (err) {
      console.log('修改数据上传失败: ' + err.message);
    }
  }
  // 初始化加载数据
  useEffect(() => {
    const initData = async () => {
      await getData(file);
      await convertData();
    };
    initData();

  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>航班时间轴管理</h1>
        <p>使用React和vis-timeline构建的可拖拽时间轴</p>
      </header>

      <div className="controls" style={
        {
          display: 'flex',
          justifyContent: 'normal'
        }
      }>
        <select
          value={file}
          onChange={(e) => {
            setFile(e.target.value);
            localStorage.setItem('savedData', '');
            getData(e.target.value).then(convertData);
          }}
        >
          {FILE_OPTIONS.map(option => (
            <option value={option}>{option}</option>
          ))}
        </select>
        <span className="upload-modification-controls">
          <button className="upload-modification-btn" onClick={uploadModification}>
            <i className="fas fa-plus"></i> 上传更改
          </button>
        </span>

        <span className="upload-disruption-controls">
          <button className="upload-disruption-btn" onClick={uploadDisruption}>
            <i className="fas fa-plus"></i> 编辑扰动
          </button>
        </span>

        <span className="calculate-controls">
          <button className="calculate-btn" onClick={calculate}>
            <i className="fas fa-plus"></i> 求解
          </button>
        </span>

        <span className="restore-controls">
          <button className="restore-btn" onClick={() => {
            localStorage.setItem('savedData', '');
            getData(file).then(convertData);
            setModified(false);
          }}>
            <i className="fas fa-plus"></i> 还原
          </button>
        </span>

        <span className="controls">
          <button className="btn" onClick={() => { alert(`${modified}`) }}>
            <i className="fas fa-plus"></i> 测试（待删除）
          </button>
        </span>
      </div>

      <div className="timeline-container">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>加载时间轴数据...</p>
          </div>
        ) : error ? (
          <div className="error">
            <i className="fas fa-exclamation-triangle"></i>
            <p>{error}</p>
            <button onClick={getData(file)} className="retry-btn">
              重试
            </button>
          </div>
        ) : (
          <div ref={timelineContainerRef} className="timeline" />
        )}
      </div>
      {showDisruptionForm && (
        <DisruptionForm
          onSubmit={handleDisruptionSubmit}
          onClose={() => setShowDisruptionForm(false)}
          initialData={formData}
          onDataChange={setFormData}>

        </DisruptionForm>

      )}      
      {showEditForm && (
        <EditForm
          item={selectedItem}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowEditForm(false);
            setSelectedItem(null);
          }}
        />

      )}
      <div className="upload-status">
        {uploadingDisruption && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在提交扰动数据...</p>
          </div>
        )}
        {uploadDisruptionError && (
          <div className="error"><p>
            <i className="fas fa-exclamation-triangle"></i>
            <span>{uploadDisruptionError}</span>
            <button onClick={() => setUploadDisruptionError(null)} className="cancel-retry-btn">
              取消
            </button>
            <button onClick={() => handleDisruptionSubmit(formData)} className="retry-btn">
              重试
            </button>
          </p>
          </div>
        )}
        {uploadingModification && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在提交修改后的数据...</p>
          </div>
        )}
        {uploadModificationError && (
          <div className="error">
            <p>
              <i className="fas fa-exclamation-triangle"></i>
              <span>{uploadModificationError}</span>
              <button onClick={() => setUploadModificationError(null)} className="cancel-retry-btn">
                取消
              </button>
              <button onClick={() => uploadModification(formData)} className="retry-btn">
                重试
              </button>
            </p>
          </div>
        )}
        {calculationStatus === "running" && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在计算...</p>
          </div>
        )}

        {calculationStatus === "completed" && (
          <div className="">
            <div className="spinner"></div>
            <p>
              计算完成
              <button onClick={() => setCalculationStatus('idle')} className="cancel-retry-btn">
                取消
              </button>
              <button onClick={convertUpdatedData} className="retry-btn">
                更新
              </button>
            </p>
          </div>
        )}
      </div>

      <div className="instructions">
        <div
          className="instructions-header"
          onClick={() => setShowInstructions(!showInstructions)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <b style={{ marginRight: '10px' }}>使用说明</b>
          <span style={{ transform: `rotate(${showInstructions ? 180 : 0}deg)`, transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            ▼
          </span>
        </div>
        
          <div style={{
            maxHeight: showInstructions ? '600px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: showInstructions ? 1 : 0.8
          }}>
          <div className="instruction-sections">
            <div className="section">
              <h3>✈️ 航班操作</h3>
              <ul>
                <li>拖拽 <strong>半透明航班</strong> 调整时间/机型</li>
                <li>双击航班打开详细参数编辑</li>
                <li>红色背景区域表示时间冲突</li>
              </ul>
            </div>

            <div className="section">
              <h3>🛠️ 工具栏功能</h3>
              <ul>
                <li><strong>上传更改</strong>：保存修改到服务端</li>
                <li><strong>编辑扰动</strong>：添加机场中断等扰动</li>
                <li><strong>求解</strong>：自动优化冲突并生成新方案</li>
                <li><strong>还原</strong>：重置所有未保存的修改</li>
              </ul>
            </div>

            
          </div>
          </div>
        
      </div>

      <footer className="app-footer">
        <p>© 2025 航班时间轴管理工具 | 使用React和vis-timeline构建</p>
      </footer>
    </div>
  );
};

export default App;
