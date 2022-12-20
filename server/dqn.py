import gym
import collections
import random

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from flask import Flask
from splendor_env import *
import numpy as np

#Hyperparameters
learning_rate = 0.0005
gamma         = 0.98
buffer_limit  = 50000
batch_size    = 32

class ReplayBuffer():
    def __init__(self):
        self.buffer = collections.deque(maxlen=buffer_limit)
    
    def put(self, transition):
        self.buffer.append(transition)
    
    def sample(self, n):
        mini_batch = random.sample(self.buffer, n)
        s_lst, a_lst, r_lst, s_prime_lst, done_mask_lst = [], [], [], [], []
        
        for transition in mini_batch:
            s, a, r, s_prime, done_mask = transition
            s_lst.append(s)
            a_lst.append([a])
            r_lst.append([r])
            s_prime_lst.append(s_prime)
            done_mask_lst.append([done_mask])

        return torch.tensor(s_lst, dtype=torch.float), torch.tensor(a_lst), \
               torch.tensor(r_lst), torch.tensor(s_prime_lst, dtype=torch.float), \
               torch.tensor(done_mask_lst)
    
    def size(self):
        return len(self.buffer)

class DQN(nn.Module):
    def __init__(self):
        super(DQN, self).__init__()
        self.fc1 = nn.Linear(121, 256)
        self.fc2 = nn.Linear(256, 512)
        self.fc3 = nn.Linear(512, 256)
        self.fc4 = nn.Linear(256, 128)
        self.fc5 = nn.Linear(128, 27)

    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = F.relu(self.fc3(x))
        x = F.relu(self.fc4(x))
        x = self.fc5(x)
        return x

class Agent():
    def __init__(self):
        self.model = DQN()
        self.target_model = DQN()
        self.model.load_state_dict(self.model.state_dict())
        self.memory = ReplayBuffer()
        self.optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        self.action = [[1,1,1,0,0, 0,0],
                       [1,1,0,1,0, 0,0],
                       [1,1,0,0,1, 0,0],
                       [1,0,1,1,0, 0,0],
                       [1,0,1,0,1, 0,0],
                       [1,0,0,1,1, 0,0],
                       [0,1,1,1,0, 0,0],
                       [0,1,1,0,1, 0,0],
                       [0,1,0,1,1, 0,0],
                       [0,0,1,1,1, 0,0],
                       [2,0,0,0,0, 0,0],
                       [0,2,0,0,0, 0,0],
                       [0,0,2,0,0, 0,0],
                       [0,0,0,2,0, 0,0],
                       [0,0,0,0,2, 0,0],
                       [0,0,0,0,0, 1,0],
                       [0,0,0,0,0, 1,1],
                       [0,0,0,0,0, 1,2],
                       [0,0,0,0,0, 1,3],
                       [0,0,0,0,0, 2,0],
                       [0,0,0,0,0, 2,1],
                       [0,0,0,0,0, 2,2],
                       [0,0,0,0,0, 2,3],
                       [0,0,0,0,0, 3,0],
                       [0,0,0,0,0, 3,1],
                       [0,0,0,0,0, 3,2],
                       [0,0,0,0,0, 3,3]]
                       
        
    def select_action(self, obs, epsilon):
        out = self.model.forward(obs)
        coin = random.random()
        if coin < epsilon:
            return random.randint(0,26)
        else:
            return random.randint(14,26)
            # return out.argmax().item()
            
    def train(q, q_target, memory, optimizer):
        for i in range(10):
            s,a,r,s_prime,done_mask = memory.sample(batch_size)

            q_out = q(s)
            q_a = q_out.gather(1,a)
            max_q_prime = q_target(s_prime).max(1)[0].unsqueeze(1)
            target = r + gamma * max_q_prime * done_mask
            loss = F.smooth_l1_loss(q_a, target)
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            
def state2np(state_dict):
    new_state = np.array([])
    for state in state_dict.values():
        state = np.array(state).flatten()
        new_state = np.concatenate((new_state, state), axis=0)
    return new_state


def main():
    GM = GameManager("Aircraft")
    GM.join_game()
    GM.join_game()
    GM.start_game()
    env = GM.game

    print_interval = 20
    score = 0.0

    agent = Agent()
    
    for n_epi in range(2):
        epsilon = max(0.01, 0.08 - 0.01*(n_epi/200)) #Linear annealing from 8% to 1%
        s = env.reset()
        s = state2np(s)

        done = False
        while not done:
            done2 = False
            while not done2:
                #a = agent.select_action(torch.from_numpy(s).float(), epsilon)
                dic = env.filter()
                a=1
                b = agent.action[a]
                if dic['cards'][b[5]-1][b[6]]==0:
                    continue
                flag = True
                for i in range(4):
                    if dic['gems'][i]<b[i]:
                        flag = False
                        break
                if flag:
                    break
            print(a)
            s_prime, r, done, info = env.step(agent.action[a])
            s_prime = state2np(s_prime)
            done_mask = 0.0 if done else 1.0
            agent.memory.put((s,a,r/100.0,s_prime, done_mask))
            s = s_prime

            score += r
            
            if agent.memory.size()>2000:
                agent.train(agent.model, agent.target_model, agent.memory, agent.optimizer)

            if n_epi%print_interval==0 and n_epi!=0:
                agent.target_model.load_state_dict(agent.model.state_dict())
                print("n_episode :{}, score : {:.1f}, n_buffer : {}, eps : {:.1f}%".format(
                                                            n_epi, score/print_interval, agent.memory.size(), epsilon*100))
            if done:
                break
            #score = 0.0
        print("Done!")
    env.close()

if __name__ == '__main__':
    main()