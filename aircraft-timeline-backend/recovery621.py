import os
import argparse
import time
import random
import pandas as pd
import matplotlib.pyplot as plt

def get_ben(R):#conculate the benefit of aircraft
    PDC_r = get_PDC_r(R)
    ben_r = {}
    for i,r in R.items():
        legs = r[1:-1]
        ben_r[i] = sum(min(param.Cap_i[str(i)],param.DEMj[j]) * param.f_j[str(j)] for j in legs)-\
                        sum(param.cij[str(i)+"_"+str(j)] for j in legs)-\
                        PDC_r[str(i)]
    return ben_r
def get_PDC_r(R):
    PDC = {}
    for r in R.keys():
        _r = R[r]
        if len(_r) == 2:
            PDC[str(r)] = 0
            continue
        PDCj = 0
        for i in range(len(_r))[1:-1]:
            if param.IDj[_r[i]] > 360:
                PDCj = 1000000
            if i == 1 and param.IDj[_r[i]] < 360:
                ADT[_r[i]] = param.DET[_r[i]] + param.IDj[_r[i]]
                PDCj += param.omega[str(r) +"_"+ str(_r[1])] * (ADT[_r[i]] - param.DET[_r[i]])
            elif i != 1:
                j = _r[i-1]
                j_1 = _r[i]
                ADT[j_1] = max (ADT[j] + param.FTj[j] + 30, param.DET[j_1] + param.IDj[j_1])
                PDCj += param.omega[str(r) +"_"+ str(_r[1])]* (ADT[j_1] - param.DET[j_1])*0.003
            PDC[str(r)] = PDCj
    return PDC
def get_initial_solution(datanumber): # Flight 要按时间顺序来
    # get R
    file_path = os.path.join(base_path, f"cost_{datanumber}.csv")
    f = pd.read_csv(file_path, header=0)
    route = f.groupby("AC").agg({"Flight":list}).reset_index()
    index_R = route.apply(lambda x :x.AC, axis =1)
    R = route.set_index(keys = index_R)["Flight"].to_dict()
    for i in R.keys():
        head = R[i][0]
        tail = R[i][-1]
        head_s = f[f["Flight"] == head].DEP.to_list()
        tail_s = f[f["Flight"] == tail].ARR.to_list()
        R[i] = head_s + R[i][:] +tail_s
        for _i,j in enumerate(R[i]):
            R[i][_i] = j
    return R

def getNei_exc(route,ben_r,ben,dis_time,del_cycle,del_flight):
    non_visited = list(route.keys())
    #route_copy = route #怎么会动态拷贝哦
    global obj
    det_exc = True
    deter = True
    #num = 0
    while deter == True:
        if len(non_visited) == 1:
            print("can't exchange")
            det_exc = False
            return det_exc
        i = sorted(random.sample(non_visited,1)) # 随机选择一架飞机==>由权重值选择一架飞机
        i = i[0]
        non_visited.remove(i)
        pairs = {}
        r1 = route[i]
        dictr1 = {x: y for y, x in enumerate(r1[1:-1])}
        for j in r1[1:-1]:
             for k in r1[1:-1]:
                if param.DET[j] > dis_time: # 动态窗口
                    if int(j) <= int(k):
                        pairs[j] = k
        '''if len(pairs) == 0: # 是否无法交换？
            continue'''
        for _i in non_visited:# 找到合适的可更换区间  注意找出问题后改为non_visited
            r2 = route[_i]
            dictr2 =  {x: y for y, x in enumerate(r2[1:-1])}
            for j,k in pairs.items():# 但这个交换总是从找到的第一个区间开始找？ 先给区间进行寻找还是先找第二条再历遍区间会好些????
                index_bef = dictr1[j]+1
                index_aft = dictr1[k]+1
                new1 ={i: -100000}
                new2 ={_i: -100000}#初始化所选飞机的benefit
                for _j in  r2[1:-1]:
                    if param.DET[_j] <= dis_time:   #   动态窗口
                        continue
                    for _k in r2[1:-1]:
                        if int(_j) <= int(_k):
                            if param.Oj[str(_j)] == param.Oj[str(j)] and param.Dj[str(_k)] == param.Dj[str(k)]:#判断前站后站是否相同
                                index_before = dictr2[_j]+1
                                index_after = dictr2[_k]+1
                                # 获取前后航班段
                                leg_bef = str(r1[int(index_bef - 1)]) if index_bef - 1 == 0 else r1[int(index_bef - 1)]
                                leg_aft = str(r1[int(index_aft + 1)]) if index_aft + 2 == len(r1) else r1[int(index_aft + 1)]
                                leg_before = str(r2[int(index_before-1)]) if index_before - 1 == 0 else r2[int(index_before-1)]
                                leg_after = str(r2[int(index_after+1)])  if index_after + 2 == len(r2) else r2[int(index_after+1)]
                                
                                if CON.loc[leg_bef, _j] == 0: # 判断插入段最前的航班段能否与原航线里的断开处形成连接，即时间上是否合理
                                    continue
                                if CON.loc[_k, leg_aft] == 0: # 插入段最后段与断开处后端
                                    continue
                                if CON.loc[leg_before, j] == 0:
                                    continue
                                if CON.loc[k,leg_after] == 0:
                                    continue 
                                route_new1 = r1[:index_bef] + r2[index_before:index_after+1] + r1[index_aft+1:]
                                route_new2 = r2[:index_before] + r1[index_bef:index_aft+1] + r2[index_after+1:]
                                A = {i:route_new1}
                                B = {_i:route_new2}   
                                new1 = ben(A)#本交换只涉及两条航路，故这样就够了
                                new2 = ben(B)
                                if new1[i] + new2[_i] > ben_r[i] + ben_r[_i] + 1 : # obj 没有更新，看什么时候更新
                                    print("------------exc")
                                    route[i] = route_new1
                                    route[_i] = route_new2
                                    ben_r[i] = new1[i]
                                    ben_r[_i] = new2[_i]
                                    return det_exc
                                elif PROBA <= random.random() and new1[i] + new2[_i] > ben_r[i] + ben_r[_i] - MINBOUND:
                                    route[i] = route_new1
                                    route[_i] = route_new2
                                    ben_r[i] = new1[i]
                                    ben_r[_i] = new2[_i]
                                    return det_exc

def getNei_del(route,ben_r,ben,dis_time,del_cycle,del_flight):#0.002 0.003 0.005
    non_visited = non_visited = list(route.keys())
    det_del = True
    deter = True
    while deter == True:
        if len(non_visited) == 1:
            print("can't delete")
            det_del = False
            return det_del
        i = sorted(random.sample(non_visited,1)) # 随机选择一架飞机==>由权重值选择一架飞机
        i = i[0]
        non_visited.remove(i)
        
        pairs = [] 
        index_v = 1
        r = route[i]
        num_v = len(r[1:-1])
        for index_v in range(num_v)[1:]:
            for v in range(num_v+1)[1:]:
                j = r[v]
                if v + index_v == num_v:
                    break
                if param.DET[j] <= dis_time: #   窗口内
                    continue
                k = r[v+index_v]
                if param.Oj[str(j)] == param.Dj[str(k)]:
                    det = True
                    if det ==  True:
                        pairs.append([j,k])
                
        for j,k in pairs:
            index_s = r.index(j)
            index_e = r.index(k)
            route_new = r[:index_s] + r[index_e+1:]  #  +1?
            C = {i:route_new}
            new = ben(C)
            if new[i] > ben_r[i]:
                print("-----------del")
                del_route = r[index_s:index_e+1]
                del_cycle[param.Oj[str(j)]].append(del_route)
                for j_ in  del_route:
                    del_flight.append(j_)
                route[i] = route_new
                ben_r[i] = new[i]
                return det_del

def getNei_rep(route,ben_r,ben,dis_time,del_cycle,del_flight):#0.034 0.083 0.238
    non_visited = list(route.keys())
    det_rep =True
    while True:
        if len(non_visited) == 1:
            print("can't replace")
            det_rep = False
            return det_rep
        i = sorted(random.sample(non_visited,1)) # 随机选择一架飞机==>由权重值选择一架飞机
        i = i[0]
        non_visited.remove(i)
        r1 = route[i]
        for _i in non_visited:
            r2 = route[_i]
            for idx_j,j in enumerate(r1[1:-1]):
                if param.DET[j] <= dis_time: # 时间窗
                    continue
                for idx__j,_j in enumerate(r2[1:-1]):
                    if param.DET[_j] <= dis_time: # 时间窗
                        continue
                    if param.Oj[str(_j)] == param.Oj[str(j)] and param.Dj[str(_j)] == param.Dj[str(j)]:
                        index1 = idx_j+1
                        index2 = idx__j+1
                        legbef1 = str(r1[index1-1]) if index1-1 == 0 else r1[index1-1]
                        legaft1 = str(r1[index1+1]) if index1+2 == len(r1) else r1[index1+1]
                        legbef2 = str(r2[index2-1]) if index2-1 == 0 else r2[index2-1]
                        legaft2 = str(r2[index2+1]) if index2+2 == len(r2) else r2[index2+1]
                        if CON.loc[legbef1,_j] == 0:
                            continue
                        if CON.loc[legbef2,j] == 0:
                            continue
                        if CON.loc[_j,legaft1] == 0:
                            continue
                        if CON.loc[j,legaft2] == 0:
                            continue
                        route_new1 = r1[:index1] + [_j] + r1[index1+1:]
                        route_new2 = r2[:index2] + [j] + r2[index2+1:]
                        A = {i:route_new1}
                        B = {_i:route_new2}   
                        new1 = ben(A)
                        new2 = ben(B)
                        if new1[i] + new2[_i] > ben_r[i] + ben_r[_i] + 1 : # obj 没有更新，看什么时候更新
                            route[i] = route_new1
                            route[_i] = route_new2
                            ben_r[i] = new1[i]
                            ben_r[_i] = new2[_i]
                            return det_rep
                        elif PROBA <= random.random() and new1[i] + new2[_i] > ben_r[i] + ben_r[_i] - MINBOUND:
                            route[i] = route_new1
                            route[_i] = route_new2
                            ben_r[i] = new1[i]
                            ben_r[_i] = new2[_i]
                            return det_rep

def getNei_rep_from_del(route,ben_r,ben,dis_time,del_cycle,del_flight):#0.034 0.083 0.238
    non_visited = list(route.keys())
    det_rep =True
    for _j in del_flight:
        if len(non_visited) == 1:
            print("can't replace2")
            det_rep = False
            return det_rep
        i = sorted(random.sample(non_visited,1)) # 随机选择一架飞机==>由权重值选择一架飞机
        i = i[0]
        non_visited.remove(i)
        r1 = route[i]
        for _i in non_visited:
            r2 = route[_i]
            for idx_j,j in enumerate(r1[1:-1]):
                if param.DET[j] <= dis_time: # 时间窗
                    continue
                if param.Oj[str(_j)] == param.Oj[str(j)] and param.Dj[str(_j)] == param.Dj[str(j)]:
                    index1 = idx_j+1
                    legbef1 = str(r1[index1-1]) if index1-1 == 0 else r1[index1-1]
                    legaft1 = str(r1[index1+1]) if index1+2 == len(r1) else r1[index1+1]
                    if CON.loc[legbef1,_j] == 0:
                        continue
                    if CON.loc[_j,legaft1] == 0:
                        continue
                    route_new1 = r1[:index1] + [_j] + r1[index1+1:]
                    A = {i:route_new1}  
                    new1 = ben(A)
                    if new1[i]  > ben_r[i] + 1 : # obj 没有更新，看什么时候更新
                        route[i] = route_new1
                        ben_r[i] = new1[i]
                        del_flight.append(j)
                        del_flight.remove(_j)
                        return det_rep
                    elif PROBA <= random.random() and new1[i] > ben_r[i] - MINBOUND:
                        route[i] = route_new1
                        ben_r[i] = new1[i]
                        del_flight.append(j)
                        del_flight.remove(_j)
                        return det_rep

def getNei_add(route,ben_r,ben,dis_time,del_cycle,del_flight):
    non_visited = list(route.keys())
    det_add = True
    while True:
        if len(non_visited) == 1:
            print("can't add")
            det_add = False
            return det_add
        i = sorted(random.sample(non_visited,1)) # 随机选择一架飞机==>由权重值选择一架飞机
        i = i[0]
        non_visited.remove(i)
        r = route[i]
        for idx_j,j in enumerate(r[1:-1]):
            if param.DET[j] <= dis_time: #   窗口内
                    continue
            if idx_j != 0:
                for leg in del_cycle[param.Dj[str(j)]]:
                    if CON.loc[j,leg[0]] == 0 or CON.loc[leg[-1],r[idx_j+2]] == 0:
                        continue
                    route_new = r[:idx_j+2] + leg + r[idx_j+2:]
                    C = {i:route_new}
                    new = ben(C)
                    if new[i] > ben_r[i] + 1:
                        print("-----------add")
                        for f in leg:
                            del_flight.remove(f)
                        del_cycle[param.Dj[str(j)]].remove(leg)
                        route[i] = route_new
                        ben_r[i] = new[i]
                        return det_add
            elif idx_j == 0:
                for leg in del_cycle[param.Oj[str(j)]]:
                    if CON.loc[leg[-1],j] == 0:
                        continue
                    route_new = r[:idx_j+1] + leg + r[idx_j+1:]
                    C = {i:route_new}
                    new = ben(C)
                    if new[i] > ben_r[i] + 1:
                        print("-----------add")
                        del_cycle[param.Oj[str(j)]].remove(leg)
                        for f in leg:
                            del_flight.remove(f)
                        route[i] = route_new
                        ben_r[i] = new[i]
                        return det_add

def plot_benefits_time(A, B, title, save_path=None):
    """
    绘制以时间B为横坐标，数值A为纵坐标的图表，自动调整坐标范围
    
    参数:
        A (list): 数值列表
        B (list): 时间戳列表，由time.time()生成
        title (str): 图表标题，默认为"收益-时间关系图"
        save_path (str): 保存图表的路径，默认为None（不保存）
    
    返回:
        plt.Figure: matplotlib图表对象
    """
    # 确保输入列表长度一致
    if len(A) != len(B):
        raise ValueError("数值列表A和时间戳列表B长度必须一致")
    
    if len(A) == 0:
        raise ValueError("输入列表不能为空")
    
    # 创建图表
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # 计算相对时间（秒）
    relative_times = [t - B[0] for t in B]
    
    # 绘制折线图
    ax.plot(relative_times, A, marker='o', color='#1f77b4', linestyle='-', linewidth=2)
    
    # 设置标题和标签
    ax.set_title(title, fontsize=14)
    ax.set_xlabel("Time (s)", fontsize=12)
    ax.set_ylabel("Benefits", fontsize=12)
    
    # 自适应坐标轴
    # 为X轴添加一些边距
    x_min, x_max = min(relative_times), max(relative_times)
    x_margin = (x_max - x_min) * 0.05 if len(relative_times) > 1 else 0.5
    ax.set_xlim([x_min - x_margin, x_max + x_margin])
    
    # 为Y轴添加一些边距
    y_min, y_max = min(A), max(A)
    y_margin = (y_max - y_min) * 0.1 if y_min != y_max else 0.5
    ax.set_ylim([y_min - y_margin, y_max + y_margin])
    
    # 添加网格线
    ax.grid(True, linestyle='--', alpha=0.7)
    
    # 如果数据点小于10个，则在每个点上标注数值
    if len(A) < 10:
        for i, (x, y) in enumerate(zip(relative_times, A)):
            ax.annotate(f"{y:.2f}", (x, y), textcoords="offset points", 
                        xytext=(0, 10), ha='center')
    
    # 美化图表
    plt.tight_layout()
    
    # 如果提供了保存路径，则保存图表
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
    
    return fig

def VND_nondel(R,benr,ben,dis_time,del_cycle,del_flight):
    for _ in range(10000):
        det_rep = getNei_rep(R,benr,ben,dis_time,del_cycle,del_flight)
        T.append(time.time())
        BENI.append(sum(benr.values()) )
        det_exc = getNei_exc(R,benr,ben,dis_time,del_cycle,del_flight)
        T.append(time.time())
        BENI.append(sum(benr.values()) )
        if det_rep == False and det_exc == False:
            if _ == 0:
                return R,False
            elif _ > 0:
                return R,True

def VND(benr,ben, cooldown_lens, iterations=10000):
    """
    R              -- 当前解结构
    ben_r          -- 存放各部件效益的 dict，用于 sum(ben_r.values())
    T              -- 时间戳列表（传入空列表即可）
    BENI           -- 目标函数值列表（传入空列表即可）
    cooldown_lens  -- 各算子对应的冷却时间字典，例如 {'rep':5, 'ins':3, ...}
    iterations     -- 最大迭代次数（默认 10000）
    """
    # 按顺序排列所有算子
    ops = [
        ('rep', getNei_rep),
        ('del', getNei_del),
        ('exc', getNei_exc),
        ('rep2', getNei_rep_from_del),
        ('add', getNei_add),
    ]
    # 初始化所有冷却计数器为 0
    cooldown = {name: 0 for name, _ in ops}

    for it in range(iterations):
        iteration_success = False  # 本次迭代是否有任一算子成功
        for name, func in ops:
            # 冷却期内跳过本算子并倒计时
            if cooldown[name] > 0:
                cooldown[name] -= 1
                continue

            # 尝试调用算子
            success = func(R,benr,ben,dis_time,del_cycle,del_flight)
            T.append(time.time())
            BENI.append(sum(benr.values()))

            if success:
                iteration_success = True
            else:
                # 失败就设置对应算子的冷却期
                cooldown[name] = cooldown_lens.get(name, 0)

        # 如果本次迭代里没有任何算子成功，则提前退出
        if not iteration_success:
            print(f"第 {it+1} 次迭代中所有算子均失败，提前终止。")
            break

    
def dis_ac(R,param,ind_dis,dis_time,dis_value):
    for j in param.L:
        param.cij[f"{ind_dis}_{j}"] = 1000000
    benr = get_ben(R)
    
    R,deter = VND_nondel(R,benr,get_ben,dis_time,del_cycle,del_flight)
    
    cooldown_lens = {
        'rep': 1,   # 替换操作失败后跳过
        'del': 1,   # 删除操作失败后跳过
        'add': 1,
        'exc': 2,   # 交换操作失败后跳过
    }
    VND(benr,get_ben,cooldown_lens, iterations=10000)
    del R[ind_dis]
    return R,benr

def dis_airport(R,param,ind_dis,dis_time,dis_value):#先用较大负数引导，再优化涉及复杂的恢复机制，先把错删的连成环（删对了就移出）存为另一个列表再通过rep和add去试，最后检查并删除
    clt1, clt2 = [int(s[:2]) * 60 + int(s[2:]) for s in dis_value.split('-')]
    before_c={}
    for j in param.L:
        if param.Oj[str(j)] == ind_dis:
            if param.DET[j] >= clt1 and param.DET[j] <= clt2:
                for i in param.F:
                    before_c[f"{i}_{j}"] = param.cij[f"{i}_{j}"]
                    param.cij[f"{i}_{j}"] = 1000000
        if param.Dj[str(j)] == ind_dis:
            if param.ART[j] >= clt1 and param.ART[j] <= clt2:
                for i in param.F:
                    before_c[f"{i}_{j}"] = param.cij[f"{i}_{j}"]
                    param.cij[f"{i}_{j}"] = 1000000
    benr = get_ben(R)
    print(sum(benr.values()))
    cooldown_lens = {
        'rep': 1,   # 替换操作失败后跳过
        'del': 1,   # 删除操作失败后跳过
        'add': 1,
        'rep2': 1,
        'exc': 2,   # 交换操作失败后跳过
    }
    VND(benr,get_ben,cooldown_lens, iterations=10000)

    for i,r in R.items():
        legs = r[1:-1]
        for j in legs:
            if param.cij[str(i)+"_"+str(j)] == 1000000:
                param.cij[str(i)+"_"+str(j)] = before_c[f"{i}_{j}"]
                print("存在无法处理的航班")
                if param.Oj[str(j)] == ind_dis:
                    if param.DET[j] >= clt1 and param.DET[j] <= clt2:
                        param.IDj[j] = clt2 - param.DET[j]
                if param.Dj[str(j)] == ind_dis:
                    if param.ART[j] >= clt1 and param.ART[j] <= clt2:
                        param.ART[j] = clt2
                        param.cij[f"{i}_{j}"] = (param.ART[j]-param.DET[j])*param.cij[f"{i}_{j}"] // param.FTj[j]
    benr = get_ben(R)
    cooldown_lens = {
        'rep': 1,   # 替换操作失败后跳过
        'del': 1,   # 删除操作失败后跳过
        'add': 1,
        'rep2': 1,
        'exc': 2,   # 交换操作失败后跳过
    }
    VND(benr,get_ben,cooldown_lens, iterations=10000)
    return R,benr

class Param:
    def __init__(self, csv_path: str):
        self.df = pd.read_csv(csv_path)
        self._prepare_sets()
        self._prepare_basic_data()
        self._prepare_aircraft_assignments()
        self._prepare_connections()
        self._prepare_costs()
        self._prepare_CON()

    def _prepare_sets(self):
        f = self.df
        self.F = list(set(f.AC))
        self.AT = list(set(f.TYPE))
        self.S = list(set(f.DEP))
        self.L = list(f.Flight)

    def _prepare_basic_data(self):
        f = self.df
        self.DET = dict(zip(self.L, f.DET))
        self.ART = dict(zip(self.L, f.ART))
        self.DEMj = dict(zip(self.L, f.DEM))
        self.FTj = dict(zip(self.L, f.FT))
        self.IDj = {j: 0 for j in self.L}
        self.Oj = dict(zip(map(str, self.L), f.DEP))
        self.Dj = dict(zip(map(str, self.L), f.ARR))
        self.f_j = dict(zip(map(str, self.L), f.TIC))

    def _prepare_aircraft_assignments(self):
        f = self.df
        def get_Fs(grp, topn=1):
            return grp.sort_values(by="DET")[["DEP", "AC", "TYPE"]][:topn]
        
        initial = f.groupby("AC").apply(get_Fs).reset_index(drop=True)
        df_Fs = initial.groupby("DEP").agg({"AC": list}).reset_index()
        self.Fs = df_Fs.set_index("DEP")["AC"].to_dict()

        df_Fsa = initial.groupby(["DEP", "TYPE"]).agg({"AC": list}).reset_index()
        index_Fsa = df_Fsa.apply(lambda x: f"{x.DEP}_{x.TYPE}", axis=1)
        self.Fsa = df_Fsa.set_index(index_Fsa)["AC"].to_dict()

    def _prepare_connections(self):
        f = self.df
        self.Asj = f[['DEP', 'Flight']].apply(list, axis=1).to_list()
        self.Ajs = f[['Flight', 'ARR']].apply(list, axis=1).to_list()

        self.Ajk = []
        for i in range(len(f.Flight)):
            for j in range(len(f.Flight)):
                if f.ARR[i] == f.DEP[j] and f.ART[i] + 30 <= f.DET[j]:
                    self.Ajk.append([i+1, j+1])

    def _prepare_costs(self):
        f = self.df
        self.cij = {}
        self.omega = {}
        self.Cap_i = {}
        for i in set(f.AC):
            row_index = f[f.AC == i].index.tolist()[0]
            cap = int(f.CAP[row_index])
            self.Cap_i[str(int(i))] = cap
            for j in f.Flight:
                cost = int((f.DIS[j-1] + 2200) * (f.CAP[j-1] + 211) * 0.0115)
                key = f"{int(i)}_{int(j)}"
                self.cij[key] = cost
                self.omega[key] = cost // 360

    def _prepare_CON(self):
        """构建航段之间的连接矩阵CON，类型为DataFrame"""
        fs = self.L + list(map(str, self.S))
        self.CON = pd.DataFrame(0, index=fs, columns=fs, dtype=int)

        for i, j in self.Ajk:
            self.CON.loc[i, j] = 1
        for flight, arr in self.Ajs:
            self.CON.loc[flight, str(arr)] = 1
        for dep, flight in self.Asj:
            self.CON.loc[str(dep), flight] = 1

def build_new_table(df_o,R,param):
    table_A = pd.DataFrame(columns=df_o.columns)

    for i,r in R.items():
        for j in r[1:-1]:
            row = df_o[df_o['Flight'] == j].copy()
            row["ART"] = param.ART[j] + ADT[j] - param.DET[j]
            row["DET"] = ADT[j]
            row["AC"] = i
            table_A = pd.concat([table_A, row], ignore_index=True)
    table_A.to_csv(os.path.join(base_path,'new_schedule.csv'), index=False)                        

def process_disruption_csv(file_path: str) -> pd.DataFrame:
    # 读取数据
    df = pd.read_csv(file_path)
    # hhmm → 分钟
    def hhmm_to_minutes(hhmm_str):
        hhmm = str(hhmm_str).zfill(4)
        hours = int(hhmm[:2])
        minutes = int(hhmm[2:])
        return hours * 60 + minutes

    # 尝试将 ind_dis 转为 int，否则保留为 str
    def convert_ind_dis(value):
        try:
            return int(value)
        except ValueError:
            return str(value)

    # 应用转换
    df['dis_time'] = df['dis_time'].apply(hhmm_to_minutes)
    df['ind_dis'] = df['ind_dis'].apply(convert_ind_dis)

    return df

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument("number",type=int)
    parser.add_argument("-n",action="store_true",help="是否使用前端修改后的数据")
    args=parser.parse_args()
    num = args.number
    t1 = time.time()
    base_path = os.path.join(os.path.dirname(__file__), 'data')
    if(args.n):
        cost_file = os.path.join(base_path, f'cost_{num}_modified.csv')
    else:
        cost_file = os.path.join(base_path, f'cost_{num}.csv')        
    param = Param(cost_file)
    CON = param.CON  # 直接拿到 CON 矩阵
    R = get_initial_solution(num)
    t = 1
    PROBA = 0.99
    MINBOUND = 20000
    T=[]
    BENI = []
    ADT = {i:0 for i in param.L}
    del_flight = []
    del_cycle = {key: [] for key in param.Oj.values()}
    benr ={} 
    dis_file = os.path.join(base_path, 'disruption.csv')
    dis_df = process_disruption_csv(dis_file)
    for index, row in dis_df.iterrows():
        dis = row['dis']
        dis_time = row['dis_time']
        ind_dis = row['ind_dis']
        dis_value = row['dis_value']
        if dis == 1:# 发生航空器延误
            param.IDj[str(ind_dis)] = int(dis_value)
            benr = get_ben(R)
            R,deter = VND_nondel(R,benr,get_ben,dis_time,del_cycle,del_flight)
            cooldown_lens = {
                'rep': 1,   # 替换操作失败后跳过
                'del': 1,   # 删除操作失败后跳过
                'add': 1,
                'exc': 2,   # 交换操作失败后跳过
            }
            VND(benr,get_ben,cooldown_lens, iterations=10000)
        elif dis == 2:# 发生航空器失效
            R,benr = dis_ac(R,param,ind_dis,dis_time,dis_value)
        elif dis == 3:# 发生机场失效
            R,benr = dis_airport(R,param,ind_dis,dis_time,dis_value)
    print(benr)
    print(sum(benr.values()))
    df_o = pd.read_csv(os.path.join(base_path, f'cost_{num}.csv'))
    build_new_table(df_o,R,param)
    print(time.time()-t1)



    
