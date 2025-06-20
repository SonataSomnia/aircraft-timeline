from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import time
import threading
from flask import Response, stream_with_context
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST"]}})  # 允许跨域请求

# 数据文件路径（用户可根据需要修改）
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'data.csv')
data_map=dict(original="data.csv",modified="data_modified.csv",calculated="data_calculated.csv")
# 计算任务状态跟踪
calculation_status = "idle"
calculation_progress = 0
calculation_lock = threading.Lock()



@app.route('/api/get_data', methods=['GET'])
def get_aircraft_data():
    """
    读取航空器时间轴数据文件并返回JSON格式数据
    """
    try:
        # 从请求参数获取文件名，默认为原始数据文件
        filename = data_map[request.args.get('file', 'original')]
        data_dir = os.path.join(os.path.dirname(__file__), 'data')
        
        # 构建安全路径（防止路径遍历攻击）
        try:
            file_path = os.path.join(data_dir, filename)
            abs_path = os.path.abspath(file_path)
            if not abs_path.startswith(os.path.abspath(data_dir)):
                return jsonify({"error": "Invalid file path"}), 400
        except Exception as e:
            return jsonify({"error": f"路径解析失败: {str(e)}"}), 400

        # 安全检查：确保文件存在且在项目目录内
        if not os.path.exists(abs_path):
            return jsonify({"error": f"文件 {filename} 不存在"}), 404
            
        if not os.path.isfile(abs_path):
            return jsonify({"error": "无效的文件路径"}), 400

        # 读取并返回文件内容
        with open(abs_path, 'r', encoding='utf-8') as f:
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


def calculate_task():
    """模拟长时间计算任务"""
    global calculation_progress, calculation_status
    try:
        calculation_status = "running"
        calculation_progress = 0
        
        for i in range(10):
            time.sleep(1)
            calculation_progress = (i + 1) * 10
            print(f"计算进度: {calculation_progress}%")  # 后台日志输出进度
            
        # 最终状态更新需要原子操作
        with calculation_lock:
            calculation_status = "completed"
            calculation_progress = 100
    except Exception as e:
        with calculation_lock:
            calculation_status = f"error: {str(e)}"
            calculation_progress = -1
        app.logger.error(f"计算任务失败: {str(e)}")
    except Exception as e:
        calculation_status = "error"
        print(f"计算任务异常: {str(e)}")
    finally:
        # 确保释放锁资源
        pass

@app.route('/api/calculate', methods=['POST'])
def start_calculation():
    """启动计算任务"""
    global calculation_status, calculation_progress
    with calculation_lock:
        if calculation_status == "running":
            return jsonify({"status": "error", "message": "计算任务正在进行中"}), 409
        
        # 立即更新状态防止重复触发
        calculation_status = "running"
        calculation_progress = 0
            
        # 在锁外启动线程以避免阻塞
        thread = threading.Thread(target=calculate_task)
        thread.start()
        
        return jsonify({
            "status": "success",
            "message": "计算任务已启动",
            "task_id": thread.ident
        }), 202


@app.route('/api/stream')
def event_stream():
    def generate():
        while True:
            with calculation_lock:
                status = calculation_status
                progress = calculation_progress
            
            # SSE格式要求
            event_data = f"data: {{\"status\": \"{status}\", \"progress\": {progress}, \"timestamp\": {time.time()}}}\n\n"
            yield event_data
            
            if status == "completed" or "error" in status:
                break
                
            time.sleep(0.5)  # 更新间隔



    return Response(stream_with_context(generate()),
                  mimetype="text/event-stream",
                  headers={'X-Accel-Buffering': 'no'})  # 禁用Nginx缓存

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)