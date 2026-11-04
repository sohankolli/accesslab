"""The shipped model: a SIGN-style network over six precomputed neighbourhood views."""
from __future__ import annotations

import numpy as np
import torch
from torch import nn

from data import NODE_DIM, VIEWS


class SignNet(nn.Module):
    """Six encoders, one per view (92 → 48, ReLU, dropout), then a head (288 → 48 → 1).

    Separate encoders keep "the parent looks like a menu" and "a child is an
    icon" as distinct signals; shared weights would blur which view said what.
    """

    def __init__(self, d: int = NODE_DIM, hidden: int = 48, views: int = VIEWS, dropout: float = 0.2):
        super().__init__()
        self.d, self.views = d, views
        self.encoders = nn.ModuleList(
            nn.Sequential(nn.Linear(d, hidden), nn.ReLU(), nn.Dropout(dropout)) for _ in range(views)
        )
        self.head = nn.Sequential(
            nn.Linear(hidden * views, hidden), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hidden, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        parts = [enc(x[:, i * self.d:(i + 1) * self.d]) for i, enc in enumerate(self.encoders)]
        return self.head(torch.cat(parts, 1)).squeeze(1)


class Calibrated(nn.Module):
    """The network with its temperature folded in: outputs calibrated probabilities."""

    def __init__(self, net: SignNet, temperature: float):
        super().__init__()
        self.net = net
        self.register_buffer("temperature", torch.tensor(float(temperature)))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.net(x) / self.temperature)


def fit_sign(X_train, y_train, X_val, y_val, *, seed: int, epochs: int = 40, patience: int = 7,
             lr: float = 3e-3, weight_decay: float = 1e-4, batch: int = 256, score=None):
    """Train with a class-weighted loss and AdamW; keep the epoch best on the validation sites."""
    torch.manual_seed(seed)
    np.random.seed(seed)
    net = SignNet()
    Xt = torch.from_numpy(X_train)
    yt = torch.from_numpy(y_train.astype(np.float32))
    Xv = torch.from_numpy(X_val)
    pos = float(yt.sum())
    pos_weight = torch.tensor((len(yt) - pos) / max(pos, 1.0))
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    opt = torch.optim.AdamW(net.parameters(), lr=lr, weight_decay=weight_decay)
    gen = torch.Generator().manual_seed(seed)
    best, best_state, since = -1.0, None, 0
    history = []
    for epoch in range(epochs):
        net.train()
        for idx in torch.randperm(len(Xt), generator=gen).split(batch):
            opt.zero_grad()
            loss_fn(net(Xt[idx]), yt[idx]).backward()
            opt.step()
        net.eval()
        with torch.no_grad():
            pv = torch.sigmoid(net(Xv)).numpy()
        s = score(y_val, pv)
        history.append(s)
        if s > best:
            best, since = s, 0
            best_state = {k: v.clone() for k, v in net.state_dict().items()}
        else:
            since += 1
            if since >= patience:
                break
    net.load_state_dict(best_state)
    net.eval()
    return net, {"best_val": best, "epochs_run": len(history), "best_epoch": int(np.argmax(history)) + 1}


def logits(net: nn.Module, X: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        return net(torch.from_numpy(X)).numpy()


def fit_temperature(z: np.ndarray, y: np.ndarray) -> float:
    """Temperature scaling (Guo et al., 2017): one scalar T minimising log loss on held-out sites."""
    zt = torch.from_numpy(z.astype(np.float32))
    yt = torch.from_numpy(y.astype(np.float32))
    log_t = torch.zeros(1, requires_grad=True)  # T = exp(log_t) stays positive
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = nn.functional.binary_cross_entropy_with_logits(zt / log_t.exp(), yt)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.detach().exp().item())
