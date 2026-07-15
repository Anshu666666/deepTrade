import os
import sys
import logging
from datetime import datetime
import uuid

LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)

def setup_query_logger(query_id: str) -> logging.Logger:
    logger = logging.getLogger(query_id)
    logger.setLevel(logging.DEBUG)
    
    # Prevent duplicate handlers
    if logger.handlers:
        return logger
        
    log_file = os.path.join(LOGS_DIR, f"{query_id}.log")
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    stream_handler = logging.StreamHandler(sys.stdout)
    
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    stream_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    return logger

def generate_query_id() -> str:
    return f"query_{datetime.now().strftime('%Y%md_%H%M%S')}_{uuid.uuid4().hex[:8]}"
