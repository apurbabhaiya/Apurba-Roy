import base64
import io
import os
import unittest
from types import SimpleNamespace

import numpy as np
from fastapi import HTTPException
from PIL import Image
import app


class EncoderTests(unittest.TestCase):
    def setUp(self):
        os.environ['FACE_SERVICE_KEY'] = 'k' * 32
        app.quotas.clear()
        vector = np.zeros(512); vector[0] = 1
        self.face = SimpleNamespace(normed_embedding=vector)
        app.engine = SimpleNamespace(get=lambda image: [self.face])
        stream = io.BytesIO()
        Image.new('RGB', (16, 16), 'white').save(stream, 'JPEG')
        self.image = base64.b64encode(stream.getvalue()).decode()

    def call(self, reference=False, key=None):
        return app.encode(app.EncodeRequest(image=self.image, reference=reference),
                          'Bearer ' + (key or 'k' * 32), 'test-user')

    def test_requires_service_secret(self):
        with self.assertRaises(HTTPException) as ctx:
            self.call(key='wrong')
        self.assertEqual(ctx.exception.status_code, 401)

    def test_reference_rejects_no_face_and_multiple_faces(self):
        for faces in ([], [self.face, self.face]):
            app.engine = SimpleNamespace(get=lambda image: faces)
            with self.assertRaises(HTTPException) as ctx:
                self.call(reference=True)
            self.assertEqual(ctx.exception.status_code, 422)

    def test_group_photo_returns_all_faces(self):
        app.engine = SimpleNamespace(get=lambda image: [self.face, self.face])
        self.assertEqual(len(self.call()['embeddings']), 2)

    def test_no_face_album_photo_is_valid(self):
        app.engine = SimpleNamespace(get=lambda image: [])
        self.assertEqual(self.call()['embeddings'], [])

    def test_corrupt_image_rejected(self):
        with self.assertRaises(HTTPException):
            app.decode_image('bm90LWEtcGhvdG8=')

    def test_invalid_model_output_rejected(self):
        self.face.normed_embedding[0] = np.nan
        with self.assertRaises(HTTPException) as ctx:
            self.call()
        self.assertEqual(ctx.exception.status_code, 503)

    def test_busy_encoder_rejects_without_queue(self):
        app.lock.acquire()
        try:
            with self.assertRaises(HTTPException) as ctx:
                self.call()
            self.assertEqual(ctx.exception.status_code, 429)
        finally:
            app.lock.release()

    def test_user_quota(self):
        import time
        app.quotas['test-user'] = (time.monotonic(), 5000)
        with self.assertRaises(HTTPException) as ctx:
            self.call()
        self.assertEqual(ctx.exception.status_code, 429)


if __name__ == '__main__':
    unittest.main()
