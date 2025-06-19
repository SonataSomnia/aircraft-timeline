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
  DisturbanceForm
} from './Modal';
var data = [];
var dataModified = [];
var items = []
var groups = []
const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingDisturbance, setUploadingDisturbance] = useState(false);
  const [uploadDisturbanceError, setUploadDisturbanceError] = useState(null);
  const [uploadingModification, setUploadingModification] = useState(false);
  const [uploadModificationError, setUploadModificationError] = useState(null);
  const [showDisturbanceForm, setShowDisturbanceForm] = useState(false);
  const [formData, setFormData] = useState(null);
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
  timelineStart.setSeconds(timelineBaseDate.getSeconds() + 30000);
  const timelineEnd = new Date(timelineBaseDate);
  timelineEnd.setSeconds(timelineBaseDate.getSeconds() + 129600);

  const fetchData = async () => {
    try {

      const savedData = localStorage.getItem('savedData');
      if (savedData) {
        data = JSON.parse(savedData).data;
        dataModified = JSON.parse(savedData).dataModified;
        console.log('从本地读取缓存');
      }
      else {
        setLoading(true);
        setError(null);

        // 直接加载本地CSV文件
        const response = await fetch('http://localhost:5000/api/get_data');
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
        const newData = parsedData.data.map(item => ({
          ...item,
          status: `original`,
        }));
        const newModifiedData = newData.map(item => ({
          ...item,
          status: `modified`,
        }));
        console.log(newData);
        data = newData;
        dataModified = newModifiedData;
        localStorage.setItem('savedData', JSON.stringify({ data, dataModified }));
      }
    } catch (err) {
      setError('数据加载失败: ' + err.message);
      setLoading(false);
    }
  };

  const convertData = async () => {
    // 转换航班数据为时间轴格式
    const combinedData = [...data, ...dataModified];
    const transformedItems = combinedData.flatMap((item) => {
      const originalGroupId = parseInt(item.Aircraft, 10);
      const backupGroupId = originalGroupId + 0.5;
      const color = stringToColor(item.Flight, item.Aircraft, item.status === 'original' ? 1 : 0.5);
      const timelineItem = {
        ...item,
        id: item.status === 'original' ?
          `${item.IATA_CODE_Reporting_Airline}-${item.Flight}` :
          `${item.IATA_CODE_Reporting_Airline}-${item.Flight}-modified`,
        content: (
          <FlightCard
            color={color}
            airline={item.Reporting_Airline}
            flightType={item.ACtype}
            SDT={minuteToHhmm(Math.floor(item.SDT / 60))}
            SAT={minuteToHhmm(Math.floor(item.SAT / 60))}
            from={item.Form}
            to={item.To}
            overlap={false}
          />
        ),
        start: new Date(timelineBaseDate.getTime() + item.SDT * 1000),
        end: new Date(timelineBaseDate.getTime() + item.SAT * 1000),
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
    const aircraftTypes = [...new Set(data.map(item => item.Aircraft))];
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
  // 初始化时间轴
  useEffect(() => {
    if (items.length === 0 || groups.length === 0 || !timelineContainerRef.current) return;

    const options = {
      editable: true,
      margin: { item: 20 },
      orientation: 'top',
      selectable: true,
      showCurrentTime: true,
      clickToUse: true,
      zoomMin: 1000 * 60 * 5, // 5分钟
      zoomMax: 1000 * 60 * 60 * 12, // 24小时
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
    if(item.group%1===0){
      
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

    items.remove(items.get({
      filter: item => item.className === 'overlap-interval'
    }).map(item => item.id));

    if (oldItem.group === item.group) {
      items.add(updateOverlap([item.group]));
    } else {
      items.add(updateOverlap([oldItem.group, item.group]));
    }

    // 将时间转换为相对于基准时间的分钟数
    const dateToMinute = (date) => {
      const diff = date - timelineBaseDate;
      return Math.round(diff / 1000 / 60);
    };

    // 解析航班号和状态
    const [airline, flight, status] = item.id.split('-');
    const isModified = status === 'modified';

    // 找到对应的数据记录
    const targetArray = dataModified
    const record = targetArray.find(r =>
      r.IATA_CODE_Reporting_Airline === airline &&
      r.Flight === parseInt(flight)
    );
    console.log('moving to', record.group, item.start, item.end, item.id, item.group);
    if (record) {
      // 更新时间数据
      record.SDT = dateToMinute(item.start) * 60;
      record.SAT = dateToMinute(item.end) * 60;
      item.SDT = record.SDT;
      item.SAT = record.SAT;
      setFlightCard(item);
      record.Aircraft = Math.floor(item.group).toString();
      localStorage.setItem('savedData', JSON.stringify({ data, dataModified }));

    }

    callback(item);
  };

  // 处理项目更新
  const handleItemUpdated = (item, callback) => {
    item.overlap = true;
    callback(item);
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
        body: JSON.stringify({ dataModified: JSON.parse(localStorage.getItem('savedData')).dataModified }),
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

  const uploadDisturbance = () => {
    setShowDisturbanceForm(true);
    // 保留之前填写的表单数据
    if (!formData) {
      setFormData({
        dis: '1',
        dis_ind: 'flight',
        dis_time: '',
        dis_value: ''
      });
    }
  };

  const handleDisturbanceSubmit = async (formData) => {
    try {
      setUploadingDisturbance(true);
      setUploadDisturbanceError(null);
      const response = await fetch('http://localhost:5000/api/submit_disturbance', {
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
      setUploadDisturbanceError(null);
    } catch (err) {
      setUploadDisturbanceError('扰动提交失败: ' + err.message);
    } finally {
      setUploadingDisturbance(false);
      setShowDisturbanceForm(false);
    }
  };


  // 初始化加载数据
  useEffect(() => {
    const initData = async () => {
      await fetchData();
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
        <span className="save-controls">
          <button className="save-btn" onClick={uploadModification}>
            <i className="fas fa-plus"></i> 上传更改
          </button>
        </span>

        <span className="upload-controls">
          <button className="upload-btn" onClick={uploadDisturbance}>
            <i className="fas fa-plus"></i> 编辑扰动
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
            <button onClick={fetchData} className="retry-btn">
              重试
            </button>
          </div>
        ) : (
          <div ref={timelineContainerRef} className="timeline" />
        )}
      </div>
      {showDisturbanceForm && (
        <DisturbanceForm
          onSubmit={handleDisturbanceSubmit}
          onClose={() => setShowDisturbanceForm(false)}
          initialData={formData}
          onDataChange={setFormData}>

        </DisturbanceForm>
        
      )}
      <div className="upload-status">
        {uploadingDisturbance && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在提交扰动数据...</p>
          </div>
        )}
        {uploadDisturbanceError && (
          <div className="error"><p>
            <i className="fas fa-exclamation-triangle"></i>
            <span>{uploadDisturbanceError}</span>
            <button onClick={() => setUploadDisturbanceError(null)} className="cancel-retry-btn">
              取消
            </button>
            <button onClick={() => handleDisturbanceSubmit(formData)} className="retry-btn">
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
      </div>

      <div className="instructions">
        <h3>使用说明：</h3>
        <ul>
          <li>pass</li>
        </ul>
      </div>

      <footer className="app-footer">
        <p>© 2025 航班时间轴管理工具 | 使用React和vis-timeline构建</p>
      </footer>
    </div>
  );
};

export default App;
