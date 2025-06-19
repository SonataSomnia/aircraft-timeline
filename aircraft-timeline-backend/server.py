from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST"]}})  # 允许跨域请求

# 数据文件路径（用户可根据需要修改）
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'data_100-5.csv')

@app.route('/api/get_data', methods=['GET'])
def get_aircraft_data():
    """
    读取航空器时间轴数据文件并返回JSON格式数据
    """
    try:
        # 安全检查：确保文件存在且在项目目录内
        if not os.path.exists(DATA_FILE):
            return jsonify({"error": "Data file not found"}), 404
            
        if not os.path.isfile(DATA_FILE):
            return jsonify({"error": "Invalid data file path"}), 400

        # 读取并返回文件内容
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = f.read()
            return jsonify({
                "status": "success",
                "data": data
            })
            
    except Exception as e:
        return jsonify({
            "error": f"Error reading data: {str(e)}"
        }), 500

@app.route('/api/submit_disturbance', methods=['POST'])
def handle_disturbance():
    """处理扰动数据提交并保存到CSV文件"""
    try:
        # 验证请求数据
        data = request.get_json()
        required_fields = ['dis', 'dis_ind', 'dis_time', 'dis_value']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        # 创建data目录（如果不存在）
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        os.makedirs(data_dir, exist_ok=True)
        
        # CSV文件路径
        csv_path = os.path.join(data_dir, 'dis.csv')
        
        # 写入数据
        file_exists = os.path.exists(csv_path)
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            f.write('dis,dis_ind,dis_time,dis_value\n')
            f.write(f"{data['dis']},{data['dis_ind']},{data['dis_time']},{data['dis_value']}\n")
        
        return jsonify({
            "status": "success",
            "message": "Disturbance data saved successfully"
        }), 200

    except Exception as e:
        return jsonify({
            "error": f"Error processing request: {str(e)}"
        }), 500

@app.route('/api/upload_modification', methods=['POST'])
def handle_modification():
    """处理前端修改数据的上传并保存为CSV"""
    try:
        # 获取并验证数据
        data = request.get_json()
        if not data or 'dataModified' not in data:
            return jsonify({"error": "Missing dataModified field"}), 400

        # 获取模板文件的表头顺序
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            header = f.readline().strip().split(',')

        # 构建CSV内容
        csv_content = []
        csv_content.append(','.join(header))  # 使用模板文件的表头顺序
        
        for item in data['dataModified']:
            # 按模板表头顺序生成行数据
            row = [str(item.get(field, '')) for field in header]
            csv_content.append(','.join(row))

        # 保存文件
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        os.makedirs(data_dir, exist_ok=True)
        csv_path = os.path.join(data_dir, 'data_modified.csv')
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            f.write('\n'.join(csv_content))

        return jsonify({
            "status": "success",
            "message": f"保存成功，共处理{len(data['dataModified'])}条记录",
            "file_path": csv_path
        }), 200

    except Exception as e:
        return jsonify({
            "error": f"数据处理失败: {str(e)}"
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)