# 部署

## 环境要求
- Node.js v16+
- Python 3.8+
- npm 8+
- pip 21+

## 项目初始化
```bash
git clone https://github.com/SonataSomnia/aircraft-timeline.git
cd aircraft-timeline
```

## 后端服务配置

### 安装依赖
```bash
cd aircraft-timeline-backend
pip install -r requirements.txt
```

## 前端应用配置
```bash
# 安装Node模块
cd ../aircraft-timeline-frontend
npm install
```

## 服务启动
```bash
# 终端1 - 启动后端（5000端口）
cd aircraft-timeline-backend && python server.py

# 终端2 - 启动前端（3000端口）
cd ../aircraft-timeline-frontend && npm start
```

## 系统
- 访问前端界面：http://localhost:3000
- 测试API接口：http://localhost:5000/api/get_data

## 开发注意事项
1. API调试工具：
```bash
curl -X GET http://localhost:5000/api/get_data 
```

2. 数据修改流程：
   - 前端修改 -> 保存到data_modified.csv（？应该吗）
   - 扰动数据 -> 保存到dis.csv


## 项目结构树
```
.
├── aircraft-timeline-backend
│   ├── server.py
│   ├── data/
│   │   ├── data_100-5.csv
│   │   ├── dis.csv
│   │   └── data_modified.csv
│   └── requirements.txt
├── aircraft-timeline-frontend
│   ├── public/
│   └── src/
└── README.md
```