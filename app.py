import os
import csv
import hashlib
import random
import socket
from flask import Flask, request, session, redirect, url_for, render_template, jsonify, send_from_directory

ROOT = os.path.dirname(os.path.abspath(__file__))
STIMULI_DIR = os.path.join(ROOT, 'stimuli')
EXAMPLES_DIR = os.path.join(ROOT, 'examples')
OUTPUT_DIR = os.path.join(ROOT, 'output')
PORT = 5001

LINES_HEADER = ['participant_id', 'stimulus_filename', 'stimulus_order', 'line_index', 'drawing_mode',
                'x0', 'y0', 'cx1', 'cy1', 'cx2', 'cy2', 'x1', 'y1', 'timestamp']

app = Flask(__name__)
app.secret_key = os.urandom(24)


def get_stimuli():
    files = [f for f in os.listdir(STIMULI_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    return sorted(files)


def get_shuffled_order(participant_id, stimuli):
    # seeded from the ID, so the same ID always gets the same sequence
    seed = int(hashlib.md5(participant_id.encode()).hexdigest(), 16) % (2 ** 32)
    order = list(stimuli)
    random.Random(seed).shuffle(order)
    return order


def participant_dir(participant_id):
    return os.path.join(OUTPUT_DIR, participant_id)


def lines_csv(participant_id):
    return os.path.join(participant_dir(participant_id), 'compolines.csv')


def order_csv(participant_id):
    return os.path.join(participant_dir(participant_id), 'compolines_order.csv')


# ---------- screens ----------

@app.route('/')
def index():
    return render_template('index.html',
                           num_stimuli=len(get_stimuli()),
                           warning=request.args.get('warning'),
                           existing_id=request.args.get('existing_id'))


@app.route('/start', methods=['POST'])
def start():
    participant_id = request.form.get('participant_id', '').strip()
    if not participant_id or any(c in participant_id for c in '/\\ '):
        return redirect(url_for('index', warning='Bitte eine gültige Teilnehmer-ID eingeben. / '
                                                 'Please enter a valid participant ID.'))
    if os.path.exists(lines_csv(participant_id)) and request.form.get('overwrite') != '1':
        return redirect(url_for('index', existing_id=participant_id,
                                warning=f'Für die ID "{participant_id}" liegen bereits Daten vor. / '
                                        f'Data for ID "{participant_id}" already exist.'))

    stimuli = get_stimuli()
    assert stimuli, 'No images found in stimuli/'
    order = get_shuffled_order(participant_id, stimuli)

    session['participant_id'] = participant_id
    session['order'] = order
    session['index'] = 0

    os.makedirs(participant_dir(participant_id), exist_ok=True)
    if os.path.exists(lines_csv(participant_id)):
        os.remove(lines_csv(participant_id))
    with open(order_csv(participant_id), 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['participant_id', 'stimulus_order', 'stimulus_filename'])
        for i, fname in enumerate(order):
            writer.writerow([participant_id, i + 1, fname])

    return redirect(url_for('example'))


@app.route('/example')
def example():
    if 'participant_id' not in session:
        return redirect(url_for('index'))
    return render_template('example.html')


@app.route('/draw')
def draw():
    if 'participant_id' not in session:
        return redirect(url_for('index'))
    order, index = session['order'], session['index']
    if index >= len(order):
        return redirect(url_for('done'))
    return render_template('draw.html',
                           stimulus_filename=order[index],
                           stimulus_order=index + 1,
                           total=len(order))


@app.route('/api/save', methods=['POST'])
def save():
    if 'participant_id' not in session:
        return jsonify({'error': 'No session'}), 400
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON'}), 400

    participant_id, order, index = session['participant_id'], session['order'], session['index']
    if index >= len(order):
        return jsonify({'error': 'No more stimuli'}), 400

    path = lines_csv(participant_id)
    write_header = not os.path.exists(path)
    with open(path, 'a', newline='') as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(LINES_HEADER)
        for i, line in enumerate(data.get('lines', [])):
            writer.writerow([participant_id, order[index], index + 1, i, line['mode'],
                             round(line['x0'], 4), round(line['y0'], 4),
                             round(line['cx1'], 4), round(line['cy1'], 4),
                             round(line['cx2'], 4), round(line['cy2'], 4),
                             round(line['x1'], 4), round(line['y1'], 4),
                             line['timestamp']])

    session['index'] = index + 1
    target = 'done' if index + 1 >= len(order) else 'draw'
    return jsonify({'redirect': url_for(target)})


@app.route('/done')
def done():
    participant_id = session.pop('participant_id', None)
    session.pop('order', None)
    session.pop('index', None)
    return render_template('done.html', participant_id=participant_id)


# ---------- files ----------

@app.route('/stimuli/<path:filename>')
def serve_stimulus(filename):
    return send_from_directory(STIMULI_DIR, filename)


@app.route('/examples/<path:filename>')
def serve_example(filename):
    return send_from_directory(EXAMPLES_DIR, filename)


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


if __name__ == '__main__':
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f'\nLocal access:   http://127.0.0.1:{PORT}')
    print(f'Network access: http://{get_local_ip()}:{PORT}   <- open this on the tablet\n')
    app.run(host='0.0.0.0', port=PORT, debug=False)
