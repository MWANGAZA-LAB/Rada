import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';

const ScanScreen = ({ navigation }) => {
  const [scanning, setScanning] = useState(true);
  
  const onSuccess = async (e) => {
    setScanning(false);
    try {
      const data = JSON.parse(e.data);
      if (data.merchantId && data.amount) {
        navigation.navigate('Send', {
          merchantId: data.merchantId,
          amount: data.amount,
          businessName: data.businessName
        });
      } else {
        Alert.alert('Invalid QR Code', 'This QR code is not a valid payment request');
        setScanning(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not process QR code');
      setScanning(true);
    }
  };

  return (
    <View style={styles.container}>
      <QRCodeScanner
        onRead={onSuccess}
        flashMode={RNCamera.Constants.FlashMode.auto}
        topContent={
          <Text style={styles.instructions}>
            Scan merchant's QR code to process payment
          </Text>
        }
        bottomContent={
          <TouchableOpacity 
            style={styles.buttonTouchable}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  instructions: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
  },
  buttonTouchable: {
    padding: 16,
  },
  buttonText: {
    fontSize: 21,
    color: '#fff',
  },
});

export default ScanScreen;
